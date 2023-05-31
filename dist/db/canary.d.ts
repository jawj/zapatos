/**
 * This value gets incremented whenever there's an incompatible change to the
 * generated schema format, in order to raise a type error and thereby force
 * schema regeneration.
 */
export interface SchemaVersionCanary {
    version: 104;
}
