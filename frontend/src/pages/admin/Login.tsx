import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Container,
  Button,
  Text,
  Stack,
  Anchor,
  Group,
} from '@mantine/core';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const token = response?.data?.token;
      if (!token) {
        throw new Error('Token manquant dans la réponse serveur');
      }
      login(token);
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
        setError('Connexion impossible. Vérifie tes identifiants.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size={460} my={60}>
      <Stack gap="xs" align="center">
        <Title order={2} fw={800}>Connexion admin</Title>
        <Text c="dimmed" size="sm">Accède à ton espace de gestion</Text>
      </Stack>

      <Paper withBorder shadow="md" p={30} mt={25} radius="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="admin@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              label="Mot de passe"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <Text c="red" size="sm" fw={500}>
                {error}
              </Text>
            )}
            <Button type="submit" loading={loading} fullWidth>
              Se connecter
            </Button>
          </Stack>
        </form>

        <Group justify="center" mt="md" gap={4}>
          <Text size="sm" c="dimmed">Pas encore de compte ?</Text>
          <Anchor component={Link} to="/admin/register" size="sm">
            Créer un compte
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}
