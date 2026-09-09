export type Gender = "male" | "female" | "unknown";
export type DiseaseStatus = "unknown" | "unaffected" | "affected";
export type IdentityMarker = "none" | "proband" | "consultand";
export type PersonType = "person" | "sab";
export type TwinType = "monozygotic" | "dizygotic" | "unknown";

export interface CarrierStatus {
  ar: boolean;
  xlr: boolean;
  recorded: boolean;
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  diseaseStatus: DiseaseStatus;
  carrier: CarrierStatus;
  marker: IdentityMarker;
  deceased: boolean;
  deathNote: string;
  type: PersonType;
  gestationalAge: string;
  genotype: string;
  variants: string;
  phenotypes: string;
  /** User-authored lines shown below the automatic generation number. */
  annotationLines: string[];
  birthOrder: number;
}

export interface Union {
  id: string;
  partnerA: string;
  partnerB: string;
  consanguineous: boolean;
  relationshipNote: string;
}

export interface Parentage {
  id: string;
  childId: string;
  unionId: string;
  birthOrder: number;
}

export interface TwinGroup {
  id: string;
  memberIds: string[];
  type: TwinType;
}

export interface Settings {
  horizontalSpacing: number;
  generationSpacing: number;
  showUnknownDisease: boolean;
  manualOffsets: Record<string, { x: number; y: number }>;
  symbolStyle: "traditional-teaching";
}

export interface Pedigree {
  schemaVersion: 1;
  id: string;
  name: string;
  updatedAt: string;
  persons: Person[];
  unions: Union[];
  parentage: Parentage[];
  twinGroups: TwinGroup[];
  settings: Settings;
}

export interface PositionedPerson {
  person: Person;
  generation: number;
  number: string;
  x: number;
  y: number;
  textLines: string[];
}

export interface Layout {
  people: PositionedPerson[];
  unions: Array<Union & { x1: number; y1: number; x2: number; y2: number; centerX: number; centerY: number; normalX: number; normalY: number; childX: number; childY: number }>;
  width: number;
  height: number;
  viewBoxX: number;
  viewBoxY: number;
  titleY: number;
  legendY: number;
}
