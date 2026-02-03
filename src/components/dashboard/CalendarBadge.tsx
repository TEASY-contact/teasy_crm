import { Badge, Text } from "@chakra-ui/react";
import { ThinParen } from "@/components/common/ui/BaseAtoms";

const STEP_COLORS: Record<string, string> = {
    demo_schedule: "blue", demo_complete: "blue",
    install_schedule: "green", install_complete: "green",
    as_schedule: "pink", as_complete: "pink"
};

export const CalendarBadge = ({ type, region, isCompleted, isSingle }: any) => {
    // Determine Label based on type
    let label = "";
    if (type.includes('demo') || type.includes('시연')) label = "시연";
    else if (type.includes('install') || type.includes('시공') || type.includes('설치')) label = "시공";
    else if (type.includes('as') || type.includes('A/S')) label = "A/S";

    // Determine Color based on type (fallback to gray if undefined, though user said no others exist)
    let colorKey = "gray";
    if (type.includes('demo') || type.includes('시연')) colorKey = "blue";
    if (type.includes('install') || type.includes('시공') || type.includes('설치')) colorKey = "green";
    if (type.includes('as') || type.includes('A/S')) colorKey = "pink";

    return (
        <Badge
            colorScheme={colorKey}
            variant="subtle"
            w="95%"
            mx="auto"
            h="18px"
            px={0.5}
            display="flex"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            textDecoration={isCompleted ? "line-through" : "none"}
            pointerEvents="none"
            borderRadius="15%"
            whiteSpace="nowrap"
            overflow="hidden"
            fontSize="10px"
            fontWeight="600"
            letterSpacing="-0.5px"
        >
            <Text display="inline-block">
                {label === "A/S" ? (
                    <><ThinParen text="A/S" /></>
                ) : (
                    label
                )}
                {region && (
                    <><ThinParen text={`(${region})`} /></>
                )}
            </Text>
        </Badge>
    );
};
