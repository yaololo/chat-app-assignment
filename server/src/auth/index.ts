import { Router } from "express";
import { login } from "./login.js";
import { getUser } from "./get-user.js";
import { logout } from "./logout.js";

const auth = Router();

auth.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
auth.post("/login", login);
auth.get("/me", getUser);
auth.post("/logout", logout);

export { auth };
