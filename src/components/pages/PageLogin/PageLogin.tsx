import { useState } from "react";
import { Button, TextField, Box, Typography } from "@mui/material";
import { useLogin, useRegister } from "~/queries/auth";

const DEFAULT_PASSWORD = "TEST_PASSWORD";

const PageLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) {
      alert("Username and Password are required.");
      return;
    }
    try {
      const result = await loginMutation.mutateAsync({
        username,
        password,
      });
      const loginRes = result as { token_type: "Basic"; access_token: string };
      if (loginRes && loginRes.access_token) {
        localStorage.setItem("authorization_token", loginRes.access_token);
        window.location.href = "/";
      } else {
        setError("No access_token returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) {
      alert("Username and Password are required.");
      return;
    }
    try {
      await registerMutation.mutateAsync({ name: username, password });
      alert("Register successful. You can now log in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Register failed");
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="80vh"
      maxWidth="25%"
      marginX="auto"
    >
      <Typography variant="h4" mb={2}>
        My Store Login
      </Typography>
      <TextField
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        margin="normal"
        fullWidth
        required
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
        fullWidth
        required
      />
      {error && (
        <Typography color="error" mt={2}>
          {error}
        </Typography>
      )}
      <Box mt={2} display="flex" gap={2}>
        <Button
          variant="outlined"
          onClick={handleRegister}
          disabled={registerMutation.isLoading}
        >
          Register
        </Button>
        <Button
          variant="contained"
          onClick={handleLogin}
          disabled={loginMutation.isLoading}
        >
          Login
        </Button>
      </Box>
    </Box>
  );
};

export default PageLogin;
