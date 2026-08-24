from pathlib import Path
import json
import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.utils import image_dataset_from_directory
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

ROOT_DIR = Path("Oily-Dry-Skin-Types")
MODEL_DIR = Path("ai-service/models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

train_dir = ROOT_DIR / "train"
valid_dir = ROOT_DIR / "valid"
test_dir = ROOT_DIR / "test"

IMG_SIZE = (160, 160)          # MobileNetV2's native-friendly size
BATCH_SIZE = 32
INITIAL_EPOCHS = 15
FINE_TUNE_EPOCHS = 10

train_ds = image_dataset_from_directory(
    train_dir,
    labels="inferred",
    label_mode="categorical",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=True,
    seed=42,
)

valid_ds = image_dataset_from_directory(
    valid_dir,
    labels="inferred",
    label_mode="categorical",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=False,
)

test_ds = image_dataset_from_directory(
    test_dir,
    labels="inferred",
    label_mode="categorical",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=False,
)

class_names = train_ds.class_names
num_classes = len(class_names)
print(f"Training classes: {class_names}")

# --- Check class balance (imbalance silently tanks accuracy) ---
import numpy as np
counts = {name: 0 for name in class_names}
for _, labels in train_ds.unbatch():
    counts[class_names[np.argmax(labels.numpy())]] += 1
print(f"Class counts (train): {counts}")
total = sum(counts.values())
class_weight = {
    i: total / (num_classes * counts[name]) for i, name in enumerate(class_names)
}
print(f"Computed class weights: {class_weight}")

AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(1000).prefetch(AUTOTUNE)
valid_ds = valid_ds.cache().prefetch(AUTOTUNE)
test_ds = test_ds.cache().prefetch(AUTOTUNE)

data_augmentation = tf.keras.Sequential(
    [
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.08),
        layers.RandomZoom(0.1),
        layers.RandomContrast(0.1),
        layers.RandomBrightness(0.1),
    ],
    name="data_augmentation",
)

# --- Transfer learning base ---
base_model = MobileNetV2(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights="imagenet",
)
base_model.trainable = False  # freeze for the first training phase

inputs = layers.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = preprocess_input(x)  # MobileNetV2-specific scaling, NOT /255
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)
x = layers.Dense(128, activation="relu")(x)
x = layers.BatchNormalization()(x)
x = layers.Dropout(0.3)(x)
outputs = layers.Dense(num_classes, activation="softmax")(x)

model = tf.keras.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=4, restore_best_weights=True
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss", factor=0.5, patience=3, min_lr=1e-5
    ),
]

print("\n--- Phase 1: training classification head (base frozen) ---")
history = model.fit(
    train_ds,
    validation_data=valid_ds,
    epochs=INITIAL_EPOCHS,
    class_weight=class_weight,
    callbacks=callbacks,
)

phase1_path = str(MODEL_DIR / "phase1_model.keras")
model.save(phase1_path)
phase1_val_loss, phase1_val_acc = model.evaluate(valid_ds, verbose=0)
print(f"Phase 1 (frozen base) val_accuracy: {phase1_val_acc:.4f}")

# --- Fine-tuning phase: unfreeze top layers of the base model ---
print("\n--- Phase 2: fine-tuning top layers of MobileNetV2 ---")
base_model.trainable = True
fine_tune_at = len(base_model.layers) - 70  # unfreeze more layers; skin
# texture is quite different from the object shapes MobileNetV2 learned
# on ImageNet, so shallow fine-tuning of only ~40 layers may not adapt
# enough of the feature hierarchy.
for layer in base_model.layers[:fine_tune_at]:
    layer.trainable = False

# CRITICAL: keep BatchNorm layers frozen even within the unfrozen range.
# Otherwise their running mean/variance get overwritten by your batch
# statistics and the pretrained features collapse (this is what caused
# val_accuracy to crash below chance-level in the previous run).
for layer in base_model.layers[fine_tune_at:]:
    if isinstance(layer, layers.BatchNormalization):
        layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),  # much lower LR
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

# Fresh callback instances so ReduceLROnPlateau/EarlyStopping state from
# phase 1 doesn't carry over (phase 1 may have already decayed the LR
# tracker or built up an early-stopping "patience" counter).
best_ckpt_path = str(MODEL_DIR / "best_checkpoint.keras")
fine_tune_callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=5, restore_best_weights=True
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss", factor=0.5, patience=2, min_lr=1e-7
    ),
    tf.keras.callbacks.ModelCheckpoint(
        best_ckpt_path, monitor="val_accuracy", save_best_only=True
    ),
]

total_epochs = INITIAL_EPOCHS + FINE_TUNE_EPOCHS
history_fine = model.fit(
    train_ds,
    validation_data=valid_ds,
    epochs=total_epochs,
    initial_epoch=history.epoch[-1] + 1,
    class_weight=class_weight,
    callbacks=fine_tune_callbacks,
)

# Load the best fine-tuning checkpoint and compare it against phase 1.
# Fine-tuning does NOT always beat the frozen-base model, especially on
# small/noisy datasets, so don't assume phase 2 is better - measure it.
fine_tuned_model = tf.keras.models.load_model(best_ckpt_path)
phase2_val_loss, phase2_val_acc = fine_tuned_model.evaluate(valid_ds, verbose=0)
print(f"Phase 2 (fine-tuned) val_accuracy: {phase2_val_acc:.4f}")

if phase2_val_acc >= phase1_val_acc:
    print("-> Keeping the fine-tuned model (it beat phase 1).")
    model = fine_tuned_model
else:
    print("-> Fine-tuning did not help; reverting to the phase 1 (frozen base) model.")
    model = tf.keras.models.load_model(phase1_path)

loss, accuracy = model.evaluate(test_ds, verbose=2)
print(f"Test accuracy: {accuracy:.4f}")

# --- Diagnostics: per-class breakdown so you can see which class is weak ---
from sklearn.metrics import classification_report, confusion_matrix

y_true, y_pred = [], []
for images, labels_batch in test_ds:
    preds = model.predict(images, verbose=0)
    y_true.extend(np.argmax(labels_batch.numpy(), axis=1))
    y_pred.extend(np.argmax(preds, axis=1))

print("\nClassification report:")
print(classification_report(y_true, y_pred, target_names=class_names))
print("Confusion matrix:")
print(confusion_matrix(y_true, y_pred))

model.save(MODEL_DIR / "skin_type_model.keras")
(MODEL_DIR / "skin_type_labels.json").write_text(json.dumps(class_names), encoding="utf-8")

print(f"Model saved to {MODEL_DIR / 'skin_type_model.keras'}")
print(f"Labels saved to {MODEL_DIR / 'skin_type_labels.json'}")