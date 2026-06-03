"use client";

import { ActivityCodesSection } from "./activity-codes-section";
import { AddressesSection } from "./addresses-section";
import { CompanyProfileForm } from "./company-profile-form";

export function SettingsClient({ companyId }: { companyId: string }) {
  return (
    <div className="space-y-8">
      <CompanyProfileForm companyId={companyId} />
      <AddressesSection companyId={companyId} />
      <ActivityCodesSection companyId={companyId} />
    </div>
  );
}
