function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  get port() {
    return Number(process.env.PORT ?? 3001);
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get pinHash() {
    return required("PIN_HASH");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get dailyCalorieGoal() {
    return Number(process.env.DAILY_CALORIE_GOAL ?? 2000);
  },
  get r2AccountId() {
    return required("R2_ACCOUNT_ID");
  },
  get r2AccessKeyId() {
    return required("R2_ACCESS_KEY_ID");
  },
  get r2SecretAccessKey() {
    return required("R2_SECRET_ACCESS_KEY");
  },
  get r2Bucket() {
    return required("R2_BUCKET");
  },
  get r2PublicUrl() {
    return required("R2_PUBLIC_URL");
  },
};
