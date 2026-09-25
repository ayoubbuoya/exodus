import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Every route needs a logged-in user by default (SessionGuard is global).
// Put @Public() on the few routes anyone may call: sign up, log in, the price chart.
// Default-deny means a new route can never be public by accident.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
