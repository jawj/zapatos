import type { EnumData } from './enums';
type TypeContext = 'JSONSelectable' | 'Selectable' | 'Insertable' | 'Updatable' | 'Whereable';
export declare const tsTypeForPgType: (pgType: string, enums: EnumData, context: TypeContext) => string;
export {};
