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

  const statusClassMap: Record<TableStatus['status'], string> = {
    idle: `${classes.statusBadge} ${classes.statusIdle}`,
    new: `${classes.statusBadge} ${classes.statusNew}`,
    in_progress: `${classes.statusBadge} ${classes.statusInProgress}`,
    served: `${classes.statusBadge} ${classes.statusServed}`,
  };

  const heroStatsData = [
    { label: 'Tables actives', value: `${activeTables}/${totalTables || 0}` },
    { label: 'Commandes en attente', value: unreadOrders.toString() },
    { label: 'Clients aujourd’hui', value: '24' },
  ];

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
    <div className={classes.dashboardRoot}>
      <div className={classes.dashboardShell}>
        <section className={`${classes.hero} ${classes.fadeIn}`}>
          <div className={classes.heroContent}>
            <span className={classes.heroBadge}>Opérations café premium</span>
            <Title order={1} className={classes.heroTitle}>
              Dashboard – {hotel?.name || currentHotel?.name}
            </Title>
            <Text className={classes.heroSubtitle}>
              Supervisez vos tables, commandes et clients avec un style barista moderne. Ce hub est prêt
              pour des expériences 3D immersives.
            </Text>
            <div className={classes.heroStats}>
              {heroStatsData.map((item) => (
                <div key={item.label} className={classes.heroStat}>
                  <p className={classes.heroStatLabel}>{item.label}</p>
                  <p className={classes.heroStatValue}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className={classes.heroActions}>
              <button type="button" className={classes.heroButton}>
                Gérer les commandes
              </button>
              <button type="button" className={classes.heroGhostButton}>
                Voir le menu
              </button>
            </div>
          </div>
          <div className={classes.hero3dWrapper}>
            <div className={classes.hero3dPlaceholder}>
              <span>☕</span>
              <Text c="dimmed" ta="center" size="sm">
                Espace réservé pour une future scène 3D (Three.js)
              </Text>
            </div>
          </div>
        </section>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" className={classes.slideUp}>
          {stats.map((stat) => (
            <Paper key={stat.title} className={classes.statCard}>
              <Group justify="space-between">
                {stat.icon}
                <div>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">
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

        <div className={classes.contentGrid}>
          <Card withBorder radius="xl" className={`${classes.card} ${classes.slideUp}`}>
            <Card.Section className={classes.section}>
              <Group justify="space-between">
                <Text fw={500}>Tables actives</Text>
                <Badge size="sm">Temps réel</Badge>
              </Group>
            </Card.Section>

            <div className={classes.tableGrid}>
              {tables.map((table) => (
                <Paper key={table.id} className={classes.tableCard} withBorder={false}>
                  <Stack gap="xs" align="center">
                    <Text size="lg" fw={600}>
                      Table {table.number}
                    </Text>
                    <Badge
                      color={statusColors[table.status]}
                      className={statusClassMap[table.status]}
                      variant="light"
                    >
                      {table.status.replace('_', ' ')}
                    </Badge>
                    {table.unreadOrders ? (
                      <Text size="sm" className={classes.unreadTag} fw={500}>
                        {table.unreadOrders} new orders
                      </Text>
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </div>
          </Card>

          <Card withBorder radius="xl" className={`${classes.card} ${classes.slideUp}`} style={{ height: '100%' }}>
            <Card.Section className={classes.section}>
              <Group justify="space-between">
                <Text fw={500}>Statut des tables</Text>
                <Badge size="sm">Temps réel</Badge>
              </Group>
            </Card.Section>

            <div className={classes.ringWrapper}>
              <Center>
                <RingProgress
                  size={190}
                  roundCaps
                  thickness={10}
                  sections={[
                    { value: totalTables ? (activeTables / totalTables) * 100 : 0, color: 'blue' },
                    { value: totalTables ? ((totalTables - activeTables) / totalTables) * 100 : 0, color: 'gray' },
                  ]}
                  label={
                    <Text size="xl" ta="center" px="xs" className={classes.ringLabel}>
                      {totalTables ? Math.round((activeTables / totalTables) * 100) : 0}%
                    </Text>
                  }
                />
              </Center>
              <div className={classes.metricRow}>
                <div className={classes.metricIndicator}>
                  <span className={`${classes.indicatorDot} ${classes.indicatorActive}`} />
                  <Text size="sm">Active</Text>
                </div>
                <Text size="sm" fw={500}>
                  {activeTables} tables
                </Text>
              </div>
              <div className={classes.metricRow}>
                <div className={classes.metricIndicator}>
                  <span className={`${classes.indicatorDot} ${classes.indicatorIdle}`} />
                  <Text size="sm">Idle</Text>
                </div>
                <Text size="sm" fw={500}>
                  {totalTables - activeTables} tables
                </Text>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

