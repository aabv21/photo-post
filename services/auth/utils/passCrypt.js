import { randomBytes, pbkdf2Sync } from "node:crypto";

class PassCrypt {
  #password;
  #salt = randomBytes(32).toString("hex");
  #iterations = 10000;
  #keyLength = 64;
  #digest = "sha256";

  #checkSalt() {
    this.#salt === null ? (this.#salt = randomBytes(32).toString("hex")) : null;
  }

  hashPassword(password) {
    this.#checkSalt();
    const hashedPassword = pbkdf2Sync(
      password,
      this.#salt,
      this.#iterations,
      this.#keyLength,
      this.#digest
    ).toString("hex");

    this.#password = `${this.#salt}:${hashedPassword}`;
    this.#salt = null;
    return this.#password;
  }

  verify(password, DBpassword) {
    this.#salt = DBpassword.split(":")[0];
    const newHashedPassword = this.hashPassword(password);
    return Object.is(newHashedPassword, DBpassword);
  }
}

const passCrypt = new PassCrypt();
passCrypt.hashPassword("123456");
export default passCrypt;
