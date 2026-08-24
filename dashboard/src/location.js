const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i;

export function isMobileDevice() {
    return Boolean(
        navigator.userAgentData?.mobile || MOBILE_USER_AGENT.test(navigator.userAgent),
    );
}

function getCurrentPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
        );
    });
}

export async function getEnvironmentQuery() {
    if (!isMobileDevice()) return "";

    const position = await getCurrentPosition();
    if (!position) return "";

    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";

    const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
    });
    return `?${params.toString()}`;
}