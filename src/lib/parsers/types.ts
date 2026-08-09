export type ParsedShape = {
  shapeKey: string;
  shapeType: "RECT" | "PATH" | "POLYGON" | "CIRCLE";
  x: number;
  y: number;
  width: number;
  height: number;
  rawShapeData?: string;
  equipmentTag?: string;
  equipmentName?: string;
  equipmentType?: string;
  layer?: string;
};

export type ParseWarning = {
  shapeKey?: string;
  message: string;
};

export type ParsedFloorPlan = {
  format: "SVG" | "JSVG";
  name: string;
  backgroundSvg: string;
  viewBox?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  sourceFileLastUpdated?: Date;
  shapes: ParsedShape[];
  warnings: ParseWarning[];
  /** Original raw file content for faithful re-export */
  originalContent: string;
};
