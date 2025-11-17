import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Container,
  Button,
  Text,
  Stack,
} from '@mantine/core';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

     // Remplacer la portion try { ... } par ce code :
try {
  // utilise l'instance axios centrale dont baseURL est http://localhost:3000/api
  const response = await api.post('/auth/login', { email, password });
  const token = response?.data?.token;
  if (!token) {
    setError('Aucun token reçu du serveur');
    return;
  }
  login(token); // ton AuthContext doit stocker le token (localStorage.setItem('token', token))
  navigate('/admin');
} catch (err: any) {
  const data = err?.response?.data;
  if (data?.errors && Array.isArray(data.errors)) {
    setError(data.errors.map((it: any) => it.msg || it.message).join('; '));
  } else if (data?.message) {
    setError(data.message);
  } else if (data?.error) {
    setError(data.error);
  } else {
    setError('Failed to login');
  }
      } finally {
        setLoading(false);
    }
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" fw={900}>
        Welcome back!
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Enter your credentials to access your account
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}

            <Button type="submit" loading={loading}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

