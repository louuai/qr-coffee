import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import api from '../../api/axios';
import { SOCKET_URL } from '../../config';
import {
  Grid,
  Card,
  Text,
  Group,
  Badge,
  Stack,
  Title,
  Paper,
  SimpleGrid,
  RingProgress,
  Center,
} from '@mantine/core';
import classes from './Dashboard.module.css';
import { IconTable, IconUsers, IconClock, IconChefHat } from '@tabler/icons-react';
import { useHotel } from '../../contexts/HotelContext';



interface TableStatus {
  id: number;
  number: number;
  status: 'idle' | 'new' | 'in_progress' | 'served';
  unreadOrders?: number;
}

interface StatsData {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

export default function Dashboard() {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { currentHotel, loading: hotelLoading } = useHotel();

  useEffect(() => {
    if (!currentHotel) {
      setHotel(null);
      setTables([]);
      setLoading(false);
      return;
    }
    const hotelId = currentHotel.id;
    let mounted = true;
    setLoading(true);
    async function load() {
      try {
        const r = await api.get(`/hotels/${hotelId}`);
        const t = await api.get(`/hotels/${hotelId}/tables`);
        if (!mounted) return;
        setHotel(r.data);
        setTables(t.data);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.emit('joinHotel', hotelId);
    socket.on('order:new', (payload: any) => {
      setTables((prev) => prev.map((p) => (
        p.number === payload.tableNumber 
          ? { ...p, status: 'new', unreadOrders: (p.unreadOrders || 0) + 1 } 
          : p
      )));
    });
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [currentHotel?.id]);

  const activeTables = tables.filter(t => t.status !== 'idle').length;
  const totalTables = tables.length;
  const unreadOrders = tables.reduce((sum, t) => sum + (t.unreadOrders || 0), 0);

  const stats: StatsData[] = [
    { 
      title: 'Active Tables', 
      value: `${activeTables}/${totalTables}`, 
      icon: <IconTable size={32} />, 
      color: 'blue' 
    },
    { 
      title: 'New Orders', 
      value: unreadOrders.toString(), 
      icon: <IconChefHat size={32} />, 
      color: 'red' 
    },
    { 
      title: 'Avg. Wait Time', 
      value: '12min', 
      icon: <IconClock size={32} />, 
      color: 'orange' 
    },
    { 
      title: 'Customers Today', 
      value: '24', 
      icon: <IconUsers size={32} />, 
      color: 'green' 
    },
  ];

  const statusColors = {
    idle: 'gray',
    new: 'blue',
    in_progress: 'orange',
    served: 'green',
  };

  if (hotelLoading) {
    return <Text>Loading hotel...</Text>;
  }

  if (!currentHotel) {
    return <Text>You need to create a hotel before accessing the dashboard.</Text>;
  }

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <>
      <Title order={2} mb="md">Dashboard - {hotel?.name || currentHotel?.name}</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
        {stats.map((stat) => (
          <Paper key={stat.title} p="md" radius="md" className={classes.card}>
            <Group justify="space-between">
              {stat.icon}
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  {stat.title}
                </Text>
                <Text fw={700} size="xl">
                  {stat.value}
                </Text>
              </div>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Grid>
        <Grid.Col span={8}>
          <Card withBorder radius="md" className={classes.card}>
            <Card.Section className={classes.section}>
              <Group justify="space-between">
                <Text fw={500}>Active Tables</Text>
                <Badge size="sm">Real-time</Badge>
              </Group>
            </Card.Section>

            <Card.Section p="md">
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                {tables.map((table) => (
                  <Paper 
                    key={table.id} 
                    p="md" 
                    radius="md" 
                    withBorder
                    style={{
                      borderColor: table.status === 'new' ? 'var(--mantine-color-blue-6)' : undefined,
                      borderWidth: table.status === 'new' ? '2px' : '1px',
                    }}
                  >
                    <Stack gap="xs" align="center">
                      <Text size="lg" fw={500}>
                        Table {table.number}
                      </Text>
                      <Badge color={statusColors[table.status]}>
                        {table.status.replace('_', ' ')}
                      </Badge>
                      {table.unreadOrders ? (
                        <Text size="sm" c="blue" fw={500}>
                          {table.unreadOrders} new orders
                        </Text>
                      ) : null}
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            </Card.Section>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder radius="md" className={classes.card} style={{ height: '100%' }}>
            <Card.Section className={classes.section}>
              <Group justify="space-between">
                <Text fw={500}>Table Status</Text>
                <Badge size="sm">Real-time</Badge>
              </Group>
            </Card.Section>

            <Card.Section p="md">
              <Center py="md">
                <RingProgress
                  size={180}
                  roundCaps
                  thickness={8}
                  sections={[
                    { value: (activeTables / totalTables) * 100, color: 'blue' },
                    { value: ((totalTables - activeTables) / totalTables) * 100, color: 'gray' },
                  ]}
                  label={
                    <Text size="xl" ta="center" px="xs" style={{ pointerEvents: 'none' }}>
                      {Math.round((activeTables / totalTables) * 100)}%
                    </Text>
                  }
                />
              </Center>
              <Stack gap="xs" mt="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Badge color="blue" size="sm" variant="dot" />
                    <Text size="sm">Active</Text>
                  </Group>
                  <Text size="sm" fw={500}>{activeTables} tables</Text>
                </Group>
                <Group justify="space-between">
                  <Group gap="xs">
                    <Badge color="gray" size="sm" variant="dot" />
                    <Text size="sm">Idle</Text>
                  </Group>
                  <Text size="sm" fw={500}>{totalTables - activeTables} tables</Text>
                </Group>
              </Stack>
            </Card.Section>
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}

