import React from "react";
import { Box } from "@chakra-ui/react";

/**
 * ChecklistBadge - 체크리스트 완료/미완료 배지
 * TimelineCard 내 증상/업무 체크리스트의 ✓/✕ 아이콘을 렌더링합니다.
 */
export const ChecklistBadge = ({ completed }: { completed: boolean }) => (
    <Box
        bg={completed ? "blue.50" : "red.50"} color={completed ? "blue.500" : "red.500"}
        fontSize="10px" fontWeight="900" w="15px" h="15px" borderRadius="3px"
        display="flex" alignItems="center" justifyContent="center" mt="4px"
    >
        {completed ? "✓" : "✕"}
    </Box>
);
