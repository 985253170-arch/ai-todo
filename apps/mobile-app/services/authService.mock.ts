import { MOCK_USER } from "@/mockData/mockData";
import type { MockUser, RegisterInput } from "@/types/app";
import { delay } from "./serviceDelay";

export async function loginWithOtp(email: string): Promise<MockUser> {
  await delay();
  return { ...MOCK_USER, email };
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<MockUser> {
  void password;
  await delay();
  return { ...MOCK_USER, email };
}

export async function register(input: RegisterInput): Promise<MockUser> {
  await delay();

  if (input.password !== input.confirmPassword) {
    throw new Error("两次输入的密码不一致。");
  }

  return { ...MOCK_USER, email: input.email };
}

export async function logout(): Promise<void> {
  await delay(180);
}

export async function getCurrentUser(): Promise<MockUser | null> {
  await delay(180);
  return MOCK_USER;
}
