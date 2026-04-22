import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ usernameField: "email" });
  }

  validate(email: string, password: string): { email: string; password: string } {
    if (!email || !password) {
      throw new UnauthorizedException();
    }
    return { email, password };
  }
}
