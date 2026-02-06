// src/components/dashboard/SideStatusCards.tsx
"use client";
import { Box, HStack } from "@chakra-ui/react";
import { TeasyCardHeader, ReportBadge, TeasyPlaceholderText, TeasyList, TeasyListItem, TeasyListText, TeasyListSubText } from "@/components/common/UIComponents";

export const SideStatusCard = ({ title, count, children, placeholder, isEmpty, ...props }: any) => (
    <Box bg="white" borderRadius="xl" shadow="md" border="1px" borderColor="gray.200" h="auto" minH="150px" display="flex" flexDirection="column" role="group" {...props}>
        <TeasyCardHeader title={title} count={count} />
        <Box
            px={4}
            pb={4}
            pt={2}
            flex={1}
            overflowY="auto"
            display={!isEmpty ? "block" : "flex"}
            alignItems="center"
            justifyContent={!isEmpty ? "flex-start" : "center"}

        >
            {!isEmpty ? children : <TeasyPlaceholderText>{placeholder}</TeasyPlaceholderText>}
        </Box>
    </Box>
);
// Removed TeasyStatusItem if it's not used, or keep it if needed by dashboard.
// Dashboard likely uses the primitives (TeasyList, TeasyListItem) directly.
