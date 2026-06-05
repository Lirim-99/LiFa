import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Records the result of a manual fiscalization done in ATK's EDI portal:
 * the FCUIN (required) plus optional QR / verification URL / tax-block code.
 */
export class RecordManualCouponDto {
  @IsString()
  @MaxLength(100)
  fcuin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  qrPayload?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxBlockCode?: string;
}
