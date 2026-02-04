// src/components/features/admin/UserCreateModal.tsx
"use client";
import { useState, useRef } from "react";
import {
    VStack, FormControl, useToast, Box, Grid,
    Flex, HStack, Switch, Divider, IconButton, Center
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { CustomSelect } from "@/components/common/CustomSelect";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent, TeasyModalHeader,
    TeasyModalBody, TeasyModalFooter, TeasyButton, TeasyFormLabel, TeasyInput, TeasyFormHelperText
} from "@/components/common/UIComponents";
import { db } from "@/lib/firebase";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { initializeApp, deleteApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { UserData } from "@/types/auth";
import { MdRefresh } from "react-icons/md";

const ALL_CANDIDATE_COLORS = [
    // 1-50
    "#FF595E", "#FF4D6D", "#FF758F", "#FF8FA3", "#FFB3C1", "#FF1B6B", "#D00000", "#DC2F02", "#E85D04", "#F48C06",
    "#FB8500", "#FF4800", "#FF5400", "#FF6000", "#FF6B00", "#FF7700", "#FF8200", "#FF8E00", "#FF9900", "#FFA500",
    "#E63946", "#F25C54", "#F27059", "#F4845F", "#F79D65", "#F7B267", "#F07167", "#E07A5F", "#A06050", "#7D4F44",
    "#FFB703", "#FD9E02", "#FFC300", "#FFD60A", "#FFC301", "#FFD60B", "#FFB800", "#FF9F1C", "#FFBF69", "#FF9E01",
    "#FFBB00", "#FFD701", "#E9C46A", "#F4A261", "#E76F51", "#D17A22", "#B36A1F", "#945B1C", "#F48C07", "#F28482",
    // 51-100
    "#8AC926", "#38B000", "#008000", "#155D27", "#34A0A4", "#52B69A", "#76C893", "#99D98C", "#B5E48C", "#D9ED92",
    "#06D6A0", "#118AB2", "#2A9D8F", "#264653", "#283618", "#606C38", "#588157", "#3A5A40", "#344E41", "#84A59D",
    "#93E9BE", "#2EC4B6", "#048A81", "#02633E", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7", "#2D6A4F",
    "#1982C4", "#118AB3", "#00B4D8", "#0096C7", "#0077B6", "#023E8A", "#03045E", "#4895EF", "#4CC9F0", "#4361EE",
    "#3F37C9", "#3A0CA3", "#480CA8", "#560BAD", "#7209B7", "#B5179E", "#F72585", "#3D5A80", "#98C1D9", "#293241",
    // 101-150
    "#48CAE4", "#90E0EF", "#007201", "#008F11", "#00FF41", "#10FF01", "#007FFF", "#FF9AA3", "#FFB7B3", "#FFDAC2",
    "#FDFFB7", "#CAFFC0", "#9BF6F1", "#A0C4F1", "#EF4770", "#FFD167", "#06D6A1", "#118AB4", "#073B4D", "#A3C4F4",
    "#B1A7A7", "#EBEAEF", "#D8E2DD", "#FFE5DA", "#FFCAD5", "#F4ACB8", "#FFB3BB", "#BC6C26", "#DDA15F", "#E9EDCA",
    "#A3B18B", "#588158", "#3D405C", "#81B29B", "#F2CC90", "#BC474A", "#6B705D", "#A5A58E", "#B7B7A5", "#DDBEAA",
    "#FFE8D7", "#CB997F", "#A44A40", "#F19C7A", "#F3B563", "#A24858", "#DCC48F", "#1D3558", "#457B9E", "#A8DADD",
    // 151-200
    "#00304A", "#D62829", "#F77F01", "#FCBF4A", "#0091AE", "#2E67F9", "#5F0A88", "#2F3E47", "#354F53", "#527970",
    "#84A59E", "#CAD2C6", "#013A64", "#014F87", "#01497D", "#2A6F98", "#2C7DA1", "#468FB0", "#61A5C3", "#89C2DA",
    "#A9D6E6", "#004B24", "#006401", "#007202", "#008001", "#38B001", "#70E001", "#9EF01B", "#CCFF34", "#3D348C",
    "#7678EE", "#F7B802", "#F18702", "#F35B05", "#00AFBA", "#0081A8", "#00F5D5", "#21252A", "#343A41", "#495058",
    "#6C757E", "#ADB5BF", "#202021", "#404041", "#606061", "#808081", "#262627", "#1F1F20", "#0F0F10", "#525253",
    // 201-250
    "#7161EF", "##3a0ca3", "#4361ee", "#4cc9f0", "#7209b7", "#b5179e", "#f72585", "#f94144", "#f3722c", "#f8961e",
    "#f9844a", "#f9c74f", "#90be6d", "#43aa8b", "#4d908e", "#577590", "#277da1", "#5f0f40", "#9a031e", "#fb8b24",
    "#e36414", "#0f4c5c", "#00b4d8", "#0077b6", "#023e8a", "#03045e", "#ff4d6d", "#c9184a", "#ff758f", "#ff8fa3",
    "#ffb3c1", "#e63946", "#f1faee", "#a8dadc", "#457b9d", "#1d3557", "#2a9d8f", "#e9c46a", "#f4a261", "#e76F51",
    "#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#d9ed92", "#b5e48c", "#99d98c", "#76c893", "#52b69a",
    // 251-300
    "#34a0a4", "#168aad", "#1a759f", "#1e6091", "#184e77", "#f9dbbd", "#ffa69e", "#faf3dd", "#b8f2e6", "#aed9e0",
    "#5e60ce", "#4ea8de", "#48bfe3", "#56cfe1", "#64dfdf", "#72efdd", "#80ffdb", "#ff9b54", "#ff7f51", "#ce4257",
    "#9b2226", "#ae2012", "#bb3e03", "#ca6702", "#ee9b00", "#e9d8a6", "#94d2bd", "#0a9396", "#005f73", "#001219",
    "#22223b", "#4a4e69", "#9a8c98", "#c9ada7", "#f2e9e4", "#000814", "#001d3d", "#003566", "#ffc300", "#ffd60a",
    "#d00000", "#ffba08", "#3f37c9", "#480ca8", "#4cc9f0", "#45b7d1", "#788bff", "#54a0ff", "#00d2ff", "#3a7bd5"
];

const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
};

const getDistance = (c1: string, c2: string) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
};

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingUsers: UserData[];
}

/**
 * Internal content component that holds the form state.
 * Because TeasyModal unmounts children when closed, this state is automatically reset.
 */
const UserCreateModalContent = ({ onClose, existingUsers }: { onClose: () => void; existingUsers: UserData[] }) => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);

    const usedColors = existingUsers
        .filter((u: UserData) => u.status !== 'banned')
        .map((u: UserData) => u.representativeColor)
        .filter(Boolean);

    const getRecommendedPool = () => {
        const safeColors = ALL_CANDIDATE_COLORS.filter(color =>
            !usedColors.includes(color) &&
            !usedColors.some((used: string) => getDistance(color, used) < 15) // Still keep some distance, but focus on exact exclusion
        );
        const shuffled = [...(safeColors.length > 7 ? safeColors : ALL_CANDIDATE_COLORS)]
            .sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 7); // Show 7 colors in a single row
    };

    const [candidates, setCandidates] = useState(getRecommendedPool());
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "",
        color: candidates[0],
        kakaoWorkEnabled: false,
        canAccessCustomerData: false,
        isBanned: false
    });

    const handleRefreshColors = () => {
        setCandidates(getRecommendedPool());
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.password) {
            toast({ title: "정보 부족", description: "모든 필수 항목을 입력해주세요.", status: "warning" });
            return;
        }

        // 0. Double check color uniqueness
        const isColorTaken = existingUsers
            .filter(u => u.status !== 'banned')
            .some(u => u.representativeColor === formData.color);

        if (isColorTaken) {
            toast({ title: "색상 중복", description: "이미 다른 임직원이 사용 중인 색상입니다. 새로고침하여 다른 색상을 선택해주세요.", status: "warning" });
            handleRefreshColors();
            return;
        }

        setIsLoading(true);
        let adminApp;
        try {
            // 1. Initialize secondary app to avoid logging out current admin
            const firebaseConfig = {
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            };

            const appName = `AdminApp_${Date.now()}`;
            adminApp = initializeApp(firebaseConfig, appName);
            const adminAuth = getAuth(adminApp);

            // 2. Calculate Badge Char (New Rules)
            const usedBadgeChars = new Set(
                existingUsers
                    .filter(u => u.status !== 'banned')
                    .map(u => u.badgeChar || (u.name ? u.name[0] : ""))
                    .filter(Boolean)
            );

            let calculatedBadgeChar = formData.name[0] || "?";
            if (usedBadgeChars.has(calculatedBadgeChar)) {
                if (formData.name.length >= 2 && !usedBadgeChars.has(formData.name[1])) {
                    calculatedBadgeChar = formData.name[1];
                } else if (formData.name.length >= 3 && !usedBadgeChars.has(formData.name[2])) {
                    calculatedBadgeChar = formData.name[2];
                } else {
                    calculatedBadgeChar = `${formData.name[0]}2`;
                }
            }

            // 3. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(adminAuth, formData.email, formData.password);
            const uid = userCredential.user.uid;

            // 4. Create User Document in Firestore using the real UID
            await setDoc(doc(db, "users", uid), {
                uid: uid,
                name: formData.name,
                badgeChar: calculatedBadgeChar,
                email: formData.email,
                role: formData.role,
                representativeColor: formData.color,
                canAccessCustomerData: formData.canAccessCustomerData,
                kakaoWorkEnabled: formData.kakaoWorkEnabled,
                status: formData.isBanned ? 'banned' : 'active',
                bannedUntil: formData.isBanned ? '2124-12-31' : null,
                createdAt: serverTimestamp(),
            });

            // 4. Sign out the new user from the temporary app and delete it
            await signOut(adminAuth);
            await deleteApp(adminApp);

            toast({
                title: "생성 완료",
                description: `${formData.name}님의 계정이 생성되었습니다.`,
                status: "success"
            });
            // Delay for Firestore indexing (v123.05)
            await new Promise(resolve => setTimeout(resolve, 500));
            await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
            onClose();
        } catch (e: any) {
            console.error(e);
            let message = "계정 생성 중 오류가 발생했습니다.";
            if (e.code === 'auth/email-already-in-use') message = "이미 등록된 이메일입니다.";
            if (e.code === 'auth/weak-password') message = "비밀번호가 너무 취약합니다 (6자 이상).";

            toast({ title: "생성 실패", description: message, status: "error" });
            if (adminApp) await deleteApp(adminApp);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TeasyModalContent>
            <TeasyModalHeader position="relative">
                <IconButton
                    aria-label="Back"
                    icon={<ArrowBackIcon />}
                    size="md"
                    position="absolute"
                    left="8px"
                    top="8px"
                    color="white"
                    variant="ghost"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={onClose}
                    type="button"
                />
                <Box as="span" ml={10}>
                    임직원 계정 생성
                </Box>
            </TeasyModalHeader>
            <TeasyModalBody>
                {/* Focus Guard: Prevents automatic focus on the first input */}
                <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                <VStack spacing={5} align="stretch">
                    <FormControl isRequired>
                        <TeasyFormLabel>이름</TeasyFormLabel>
                        <TeasyInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="입력" />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>이메일 (아이디)</TeasyFormLabel>
                        <TeasyInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="입력" />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>초기 비밀번호</TeasyFormLabel>
                        <TeasyInput type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="입력" />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>권한</TeasyFormLabel>
                        <CustomSelect
                            value={formData.role}
                            onChange={(val) => {
                                setFormData({
                                    ...formData,
                                    role: val as any,
                                    isBanned: val === 'master' ? false : formData.isBanned
                                });
                            }}
                            placeholder="선택"
                            options={[
                                { value: "master", label: "최고 관리자" },
                                { value: "admin", label: "관리자" },
                                { value: "employee", label: "임직원" },
                                { value: "", label: "", isDivider: true },
                                { value: "partner", label: "협력사" },
                            ]}
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>대표 색상</TeasyFormLabel>
                        <HStack spacing={4} align="center">
                            <Box w="42px" h="42px" borderRadius="full" bg={formData.color} shadow="md" border="2px solid white" />
                            <Divider orientation="vertical" h="30px" borderColor="gray.200" />
                            <Grid templateColumns="repeat(7, 1fr)" gap={2.5} flex={1}>
                                {candidates.map((c, idx) => (
                                    <Center key={`${c}-${idx}`}>
                                        <Box
                                            w="24px" h="24px" borderRadius="full" bg={c} cursor="pointer"
                                            border={formData.color === c ? "2px solid" : "none"}
                                            borderColor="brand.500"
                                            transform={formData.color === c ? "scale(1.2)" : "none"}
                                            transition="all 0.2s"
                                            onClick={() => setFormData({ ...formData, color: c })}
                                            _hover={{ transform: "scale(1.1)", opacity: 0.8 }}
                                        />
                                    </Center>
                                ))}
                            </Grid>
                            <Divider orientation="vertical" h="30px" borderColor="gray.200" />
                            <IconButton
                                aria-label="Refresh colors"
                                icon={<MdRefresh size={24} />}
                                size="lg"
                                variant="ghost"
                                color="gray.400"
                                onClick={handleRefreshColors}
                                _hover={{ color: "brand.500", bg: "gray.100" }}
                                borderRadius="full"
                            />
                        </HStack>
                    </FormControl>

                    <FormControl isRequired pt={2}>
                        <Flex justify="space-between" align="center">
                            <TeasyFormLabel mb={0}>알람톡 수신</TeasyFormLabel>
                            <Switch size="md" colorScheme="brand" isChecked={formData.kakaoWorkEnabled} onChange={(e) => setFormData({ ...formData, kakaoWorkEnabled: e.target.checked })} />
                        </Flex>
                    </FormControl>

                    <FormControl isRequired>
                        <Flex justify="space-between" align="center">
                            <TeasyFormLabel mb={0}>고객 검색</TeasyFormLabel>
                            <Switch size="md" colorScheme="brand" isChecked={formData.canAccessCustomerData} onChange={(e) => setFormData({ ...formData, canAccessCustomerData: e.target.checked })} />
                        </Flex>
                    </FormControl>

                    <FormControl isRequired isDisabled>
                        <Flex justify="space-between" align="center" opacity={0.5}>
                            <Box>
                                <TeasyFormLabel mb={0} color="gray.400">퇴사 처리</TeasyFormLabel>
                                <TeasyFormHelperText>계정 정지 및 기록 보존</TeasyFormHelperText>
                            </Box>
                            <Switch size="md" colorScheme="gray" isChecked={false} isDisabled />
                        </Flex>
                    </FormControl>
                </VStack>
            </TeasyModalBody>
            <TeasyModalFooter borderTop="1px" borderColor="gray.100">
                <TeasyButton version="secondary" onClick={onClose}>취소</TeasyButton>
                <TeasyButton isLoading={isLoading} onClick={handleSubmit}>계정 생성</TeasyButton>
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const UserCreateModal = ({ isOpen, onClose, existingUsers }: UserCreateModalProps) => {
    return (
        <TeasyModal isOpen={isOpen} onClose={onClose}>
            <TeasyModalOverlay />
            <UserCreateModalContent onClose={onClose} existingUsers={existingUsers} />
        </TeasyModal>
    );
};
