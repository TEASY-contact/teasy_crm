"use client";
import React from "react";
import {
    VStack, Flex, Box, Text, HStack, Heading, Badge, type TextProps
} from "@chakra-ui/react";

export const PageHeader = ({ title, description, leftContent, children }: { title: string; description?: string; leftContent?: React.ReactNode; children?: React.ReactNode }) => (
    <VStack align="stretch" spacing={1} mb={10} w="full">
        <Flex align="center" minH="40px" w="full">
            <Flex align="center">
                <Heading fontSize="28px" fontWeight="bold" color="gray.700" lineHeight="1.2" m={0}>
                    {title}
                </Heading>
                {leftContent && <Box ml={4} pt="4px">{leftContent}</Box>}
            </Flex>
            <Box flex={1} />
            <HStack spacing={3} pt="2px">
                {children}
            </HStack>
        </Flex>
        {description && (
            <Text fontSize="sm" color="gray.400" fontWeight="medium" mt={-1}>
                {description}
            </Text>
        )}
    </VStack>
);

export const TeasyCardTitle = (props: TextProps) => <Text fontWeight="700" color="gray.500" fontSize="18px" {...props} />;

export const TeasyCardHeader = ({ title, count, ...props }: any) => (
    <Box p={4} borderBottom="1px" borderColor="gray.100" bg="white" borderTopRadius="xl" {...props}>
        <HStack spacing={2}>
            <TeasyCardTitle>{title}</TeasyCardTitle>
            {count > 0 && (
                <Badge
                    bg="red.50"
                    color="red.500"
                    fontSize="xs"
                    px={2}
                    py={0.5}
                    borderRadius="full"
                >
                    {count}
                </Badge>
            )}
        </HStack>
    </Box>
);

export const TeasyListItem = ({ isLast, ...props }: any) => (
    <HStack p={2} borderRadius="md" borderBottom={isLast ? "none" : "1px solid"} borderColor="gray.50" _hover={{ bg: "gray.50" }} w="full" {...props} />
);

export const TeasyList = (props: any) => <VStack align="stretch" spacing={0} w="full" {...props} />;
export const TeasyListText = (props: TextProps) => <Text fontSize="sm" fontWeight="semibold" color="gray.700" isTruncated {...props} />;
export const TeasyListSubText = (props: TextProps) => <Text fontSize="xs" color="gray.400" whiteSpace="pre-wrap" {...props} />;
