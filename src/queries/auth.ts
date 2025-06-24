import axios, { AxiosError } from "axios";
import { useMutation } from "react-query";
import API_PATHS from "~/constants/apiPaths";

interface RegisterPayload {
  name: string;
  password: string;
}

// Register: { userId: string }
interface RegisterResponse {
  userId: string;
}

interface LoginPayload {
  username: string;
  password: string;
}

// Login: { token_type: 'Basic'; access_token: string; }
interface LoginResponse {
  token_type: "Basic";
  access_token: string;
}

export function useRegister() {
  return useMutation<RegisterResponse, AxiosError, RegisterPayload>(
    async ({ name, password }) => {
      const res = await axios.post<RegisterResponse>(
        `${API_PATHS.cart}/auth/register`,
        {
          name,
          password,
        }
      );
      return res.data;
    }
  );
}

export function useLogin() {
  return useMutation<LoginResponse, AxiosError, LoginPayload>(
    async ({ username, password }) => {
      const res = await axios.post<LoginResponse>(
        `${API_PATHS.cart}/auth/login`,
        {
          username,
          password,
        }
      );
      return res.data;
    }
  );
}
