// src/app/customers/[id]/components/CustomerProfileCard.tsx
import React from "react";
import { Box, Flex, Heading, Badge, Grid, VStack } from "@chakra-ui/react";
import { Customer } from "@/types/domain";
import { ProfileItem } from "@/components/features/customer/ProfileItem";
import { DISTRIBUTOR_COLORS } from "@/utils/constants";
import { getOnlyDate } from "./CustomerDetailUtils";

interface CustomerProfileCardProps {
    customer: Customer;
    lastActivityDate?: string;
    onEdit: (label: string, field: string, values: string[]) => void;
    onActivityClick: (activity: any, confirmation?: boolean) => void;
    latestActivity?: any;
}

export const CustomerProfileCard: React.FC<CustomerProfileCardProps> = React.memo(({
    customer,
    lastActivityDate,
    onEdit,
    onActivityClick,
    latestActivity
}) => {
    const addressValues = React.useMemo(() =>
        [customer.address, ...(customer.sub_addresses || [])].filter(Boolean),
        [customer.address, customer.sub_addresses]);

    const phoneValues = React.useMemo(() =>
        [customer.phone, ...(customer.sub_phones || [])].filter(Boolean),
        [customer.phone, customer.sub_phones]);

    const licenseValues = React.useMemo(() =>
        customer.license ? [customer.license] : [],
        [customer.license]);

    const productValues = React.useMemo(() =>
        customer.ownedProducts || [],
        [customer.ownedProducts]);

    const handleAddressAdd = React.useCallback(() =>
        onEdit("주소", "address", addressValues),
        [onEdit, addressValues]);

    const handleProductAdd = React.useCallback(() =>
        onEdit("보유 상품", "ownedProducts", productValues),
        [onEdit, productValues]);

    const handlePhoneAdd = React.useCallback(() =>
        onEdit("연락처", "phone", phoneValues),
        [onEdit, phoneValues]);

    const handleLicenseAdd = React.useCallback(() =>
        onEdit("라이선스", "license", licenseValues),
        [onEdit, licenseValues]);

    return (
        <Box bg="white" p={8} borderRadius="2xl" shadow="sm" border="1px" borderColor="gray.100" mb={16}>
            <Flex align="center" mb={6}>
                <Heading size="lg" mr={3}>{customer.name}</Heading>
                {customer.distributor && (
                    <Badge
                        px={3}
                        py={1}
                        borderRadius="lg"
                        fontSize="xs"
                        fontWeight="800"
                        textTransform="none"
                        {...(DISTRIBUTOR_COLORS[customer.distributor] || { bg: "gray.100", color: "gray.600" })}
                    >
                        {customer.distributor}
                    </Badge>
                )}
            </Flex>
            <Grid templateColumns="2.8fr 5.2fr 2fr" gap={10} rowGap={8}>
                {/* Row 1 */}
                <ProfileItem
                    label="주소"
                    values={addressValues}
                    onAdd={handleAddressAdd}
                />
                <ProfileItem
                    label="보유 상품"
                    values={productValues}
                    onAdd={handleProductAdd}
                />
                <ProfileItem
                    label="최초 등록일"
                    values={[getOnlyDate(customer.registeredDate)]}
                    isDate
                    align="flex-start"
                />

                {/* Row 2 */}
                <ProfileItem
                    label="연락처"
                    values={phoneValues}
                    onAdd={handlePhoneAdd}
                />
                <ProfileItem
                    label="라이선스"
                    values={licenseValues}
                    onAdd={handleLicenseAdd}
                />
                <ProfileItem
                    label="최신 활동일"
                    values={[getOnlyDate(lastActivityDate)]}
                    isDate
                    onClick={() => latestActivity && onActivityClick(latestActivity, false)}
                    align="flex-start"
                />
            </Grid>
        </Box>
    );
});
