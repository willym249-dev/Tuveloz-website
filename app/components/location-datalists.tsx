import { InterfaceCopy } from "./interface-copy";
import {
  MONTGOMERY_COUNTY_MD_MUNICIPALITIES,
  MONTGOMERY_COUNTY_MD_ZIP_CODES,
} from "../../lib/service-matching";

export const MUNICIPALITY_DATALIST_ID = "tuveloz-municipality-options";
export const ZIP_DATALIST_ID = "tuveloz-zip-options";

export function LocationDatalists() {
  return (
    <InterfaceCopy><>
      <datalist id={MUNICIPALITY_DATALIST_ID}>
        {MONTGOMERY_COUNTY_MD_MUNICIPALITIES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id={ZIP_DATALIST_ID}>
        {MONTGOMERY_COUNTY_MD_ZIP_CODES.map((zip) => (
          <option key={zip} value={zip} />
        ))}
      </datalist>
    </></InterfaceCopy>
  );
}
