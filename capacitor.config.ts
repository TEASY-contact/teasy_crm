import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.teasy.crm",
    appName: "TEASY CRM",
    webDir: "out", // Next.js static export output directory
    server: {
        // Development: 로컬 서버 사용 (빌드 후 제거)
        // url: "http://localhost:3000",
        // cleartext: true,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#805AD5", // brand.500
            showSpinner: false,
        },
        StatusBar: {
            style: "LIGHT",
            backgroundColor: "#805AD5",
        },
        Keyboard: {
            resize: "body",
            resizeOnFullScreen: true,
        },
    },
    android: {
        allowMixedContent: true,
        captureInput: true,
    },
};

export default config;
