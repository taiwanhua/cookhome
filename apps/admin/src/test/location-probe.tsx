import { useLocation } from "react-router";

/** 測試用:把目前網址印在畫面上,讓測試以使用者看得到的方式斷言轉址。 */
export const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};
