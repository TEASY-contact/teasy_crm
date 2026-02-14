// src/utils/addressParser.ts
export const parseRegion = (address: string) => {
    // Special cities must be checked FIRST (before regex)
    if (address.includes("서울특별시")) return "서울";
    if (address.includes("광주광역시")) return "광주";
    // Extract city and remove "시" suffix (v122.0)
    const match = address.match(/([가-힣]+시)/);
    if (match) {
        return match[1].replace("시", "");
    }
    return address.slice(0, 2);
};
