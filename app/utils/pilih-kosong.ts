// Reka UI throws ("A <SelectItem /> must have a value prop that is not an empty
// string") and the dropdown never opens when one item's value is ''. The "none"
// choice of a USelect therefore carries this stand-in, while the model keeps ''.
//   :model-value="x || KOSONG" @update:model-value="x = dariKosong($event)"
export const KOSONG = '__kosong__'

export const dariKosong = (v: unknown) => (v === KOSONG || v === undefined || v === null ? '' : String(v))
