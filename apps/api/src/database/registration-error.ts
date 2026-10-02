/** 資料登記不合契約(碰撞、錯綁、缺 plugin)時拋出;屬程式錯誤,讓 app 起不來。 */
export class DatabaseRegistrationError extends Error {
  override name = "DatabaseRegistrationError";
}
