import { SetMetadata } from "@nestjs/common";

export const SKIP_KEY = 'skip';
export const SkipAuth = () => SetMetadata(SKIP_KEY, true);