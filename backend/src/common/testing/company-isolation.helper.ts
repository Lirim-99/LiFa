/**
 * Test helper: verifies that a service method scoped by company ID cannot
 * see another company's data. Used in every domain module's spec file.
 *
 *   await expectCompanyIsolation(
 *     (companyId) => contactsService.findById(companyId, contactBelongingToA.id),
 *     companyAId,
 *     companyBId,
 *   );
 *
 * The helper passes if:
 *   - The call with companyA's ID returns a value (or throws NotFound — both are OK).
 *   - The call with companyB's ID throws or returns null/undefined.
 *
 * It fails if companyB's call returns the record — that means scoping leaked.
 */
export async function expectCompanyIsolation<T>(
  serviceCall: (companyId: string) => Promise<T>,
  expectedCompanyId: string,
  foreignCompanyId: string,
): Promise<void> {
  if (expectedCompanyId === foreignCompanyId) {
    throw new Error("expectCompanyIsolation: company IDs must differ.");
  }

  let leakedResult: T | undefined;
  let leaked = false;
  try {
    leakedResult = await serviceCall(foreignCompanyId);
    leaked = leakedResult != null;
  } catch {
    leaked = false;
  }

  if (leaked) {
    throw new Error(
      `Company isolation leak detected: a call scoped to ${foreignCompanyId} ` +
        `returned data owned by ${expectedCompanyId}. Result: ${JSON.stringify(leakedResult)}`,
    );
  }
}
