import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

/**
 * Class-level field-cross validator: requires at least one of the named
 * properties on the DTO to be strictly `true`.
 *
 *   class CreateContactDto {
 *     @AtLeastOneTrue(['isCustomer', 'isVendor'])
 *     isCustomer?: boolean;
 *
 *     isVendor?: boolean;
 *   }
 *
 * Attach the decorator to ANY one of the properties — the validator inspects
 * the whole DTO and reports under that property's path. The DB-level CHECK on
 * `contacts(is_customer OR is_vendor)` is the backstop; this exists to fail
 * fast at the API boundary with a clear message.
 */
export function AtLeastOneTrue(properties: string[], options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: "atLeastOneTrue",
      target: object.constructor,
      propertyName,
      options,
      constraints: properties,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const names = args.constraints as string[];
          return names.some((name) => obj[name] === true);
        },
        defaultMessage(args: ValidationArguments) {
          const names = args.constraints as string[];
          return `At least one of ${names.join(", ")} must be true`;
        },
      },
    });
  };
}
