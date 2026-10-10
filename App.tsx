import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import * as SystemUI from "expo-system-ui";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  api,
  API_URL,
  ApiAlert,
  Greenhouse,
  Measurement,
  session,
  User,
} from "./src/api";

type Tab = "Vue" | "Analyse" | "Actions" | "Journal" | "Compte";
type AuthMode = "login" | "register" | "forgot";
type Equipment = {
  key: "pump" | "fan" | "mister" | "grow_light" | "buzzer";
  name: string;
  subtitle: string;
  icon: string;
  on: boolean;
};

const hero = require("./assets/goma-greenhouse-hero.png");
const ink = "#17231E",
  paper = "#F3F0E9",
  moss = "#123E32",
  strawberry = "#EC4E62",
  sage = "#A9B9A5",
  line = "#DEDCD4";
const night = "#0D1713",
  nightSurface = "#14221C",
  nightLine = "#293830",
  nightText = "#F3F0E9";
const ThemeContext = React.createContext({ dark: false, toggle: () => {} });
const useTheme = () => React.useContext(ThemeContext);
const demoUser: User = {
  id: 0,
  full_name: "Tussi Mwenge",
  email: "mode.demo@kivusense.cd",
};
const demoGreenhouses: Greenhouse[] = [
  {
    id: 1,
    name: "Serre Nyiragongo",
    crop: "Fraise",
    variety: "Albion",
    location: "Goma · Mugunga",
    automatic_mode: true,
    photo_url: null,
  },
  {
    id: 2,
    name: "Serre Kivu",
    crop: "Fraise",
    variety: "San Andreas",
    location: "Goma · Lac Vert",
    automatic_mode: true,
    photo_url: null,
  },
];
const demoMeasurement: Measurement = {
  id: 1,
  greenhouse_id: 1,
  air_temperature: 23.8,
  air_humidity: 71,
  soil_moisture: 58,
  luminosity: 785,
  co2: 684,
  pressure: 1012,
  water_level: 68,
  recorded_at: new Date().toISOString(),
};
const demoAlerts: ApiAlert[] = [
  {
    id: 1,
    greenhouse_id: 1,
    level: "attention",
    title: "Le sol commence à sécher",
    message:
      "La zone nord est passée sous 50 %. Un cycle court est conseillé avant 19 h.",
    resolved: false,
    created_at: new Date(Date.now() - 36e5).toISOString(),
  },
  {
    id: 2,
    greenhouse_id: 1,
    level: "info",
    title: "Cycle terminé sans anomalie",
    message:
      "La pompe a fonctionné pendant 12 minutes. Consommation estimée : 18 L.",
    resolved: true,
    created_at: new Date(Date.now() - 7.2e6).toISOString(),
  },
];
const initialEquipment: Equipment[] = [
  {
    key: "pump",
    name: "Irrigation",
    subtitle: "Dernier cycle · 08:20",
    icon: "water-outline",
    on: false,
  },
  {
    key: "fan",
    name: "Ventilation",
    subtitle: "Température maîtrisée",
    icon: "leaf-outline",
    on: true,
  },
  {
    key: "mister",
    name: "Brumisation",
    subtitle: "En attente",
    icon: "rainy-outline",
    on: false,
  },
  {
    key: "grow_light",
    name: "Éclairage",
    subtitle: "Programme · 18:00",
    icon: "sunny-outline",
    on: true,
  },
  {
    key: "buzzer",
    name: "Alarme locale",
    subtitle: "Critique uniquement",
    icon: "volume-high-outline",
    on: true,
  },
];

function Icon({
  name,
  size = 21,
  color = ink,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name as never} size={size} color={color} />;
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function LiquidGlass({
  children,
  style,
  dark = false,
  interactive = false,
}: any) {
  if (Platform.OS === "ios" && isGlassEffectAPIAvailable())
    return (
      <GlassView
        isInteractive={interactive}
        glassEffectStyle="regular"
        tintColor={dark ? "rgba(10,25,19,.48)" : "rgba(255,255,255,.34)"}
        style={style}
      >
        {children}
      </GlassView>
    );
  return (
    <BlurView
      intensity={dark ? 68 : 82}
      tint={dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
      blurMethod="dimezisBlurView"
      style={style}
    >
      {children}
    </BlurView>
  );
}

function BrandMark({ light = false }: { light?: boolean }) {
  const { dark } = useTheme();
  return (
    <View style={st.brandRow}>
      <View style={[st.brandGlyph, light && st.brandGlyphLight]}>
        <View style={st.senseOrbit} />
        <View style={st.senseCore} />
        <View style={st.senseSignal} />
      </View>
      <View>
        <Text style={[st.brandName, (light || dark) && { color: "#fff" }]}>
          KivuSense
        </Text>
        <Text
          style={[
            st.brandSignature,
            (light || dark) && { color: "rgba(235,246,240,.64)" },
          ]}
        >
          CLIMATE INTELLIGENCE
        </Text>
      </View>
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
}: any) {
  return (
    <View>
      <View style={[st.field, error && { borderColor: strawberry }]}>
        <Icon name={icon} color="#76827B" size={19} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={st.input}
          placeholder={placeholder}
          placeholderTextColor="#8C958F"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={
            keyboardType === "email-address" ? "none" : "sentences"
          }
        />
      </View>
      {error ? <Text style={st.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Auth({
  onAuthenticated,
  onDemo,
}: {
  onAuthenticated: (user: User) => void;
  onDemo: () => void;
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const change = (key: keyof typeof form) => (value: string) =>
    setForm((v) => ({ ...v, [key]: value }));
  const submit = async () => {
    if (mode === "forgot") {
      setMessage(
        "La récupération sera envoyée par le serveur de messagerie configuré.",
      );
      return;
    }
    if (!form.email.trim() || !form.password)
      return setMessage("Renseigne ton e-mail et ton mot de passe.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      return setMessage(
        "Entre une adresse e-mail valide, par exemple nom@domaine.com.",
      );
    if (
      mode === "register" &&
      (form.name.trim().length < 2 ||
        form.password.length < 8 ||
        form.password !== form.confirm)
    )
      return setMessage(
        form.name.trim().length < 2
          ? "Le nom complet doit contenir au moins 2 caractères."
          : form.password.length < 8
            ? "Le mot de passe doit contenir au moins 8 caractères."
            : "Les deux mots de passe ne correspondent pas.",
      );
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "login"
          ? await api.login(form.email.trim(), form.password)
          : await api.register({
              full_name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim() || undefined,
              password: form.password,
            });
      await session.save(result.access_token);
      onAuthenticated(result.user);
    } catch (e: any) {
      setMessage(`${e.message} · API : ${API_URL}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ImageBackground source={hero} style={st.authBg} resizeMode="cover">
      <LinearGradient
        colors={["rgba(8,24,18,.18)", "rgba(8,24,18,.30)", "rgba(8,24,18,.94)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={st.authSafe}>
        <View style={st.authTop}>
          <BrandMark light />
          <BlurView
            intensity={42}
            tint="systemThinMaterialDark"
            blurMethod="dimezisBlurView"
            style={st.locationPill}
          >
            <Icon name="location" color="#fff" size={13} />
            <Text style={st.locationText}>Goma, Nord-Kivu</Text>
          </BlurView>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              st.authContent,
              desktop && st.authContentDesktop,
            ]}
          >
            <View style={st.authTelemetry}>
              <LiquidGlass dark style={st.telemetryPill}>
                <View style={st.telemetryDot} />
                <Text style={st.telemetryText}>ESP32 CONNECTÉ</Text>
              </LiquidGlass>
              <LiquidGlass dark style={st.telemetryPill}>
                <Text style={st.telemetryValue}>23,8°</Text>
                <Text style={st.telemetryText}>AIR</Text>
              </LiquidGlass>
              <LiquidGlass dark style={st.telemetryPill}>
                <Text style={st.telemetryValue}>58%</Text>
                <Text style={st.telemetryText}>SOL</Text>
              </LiquidGlass>
            </View>
            <Text style={st.authKicker}>AGRONOMIE × SYSTÈMES EMBARQUÉS</Text>
            <Text style={st.authHeadline}>
              {mode === "login"
                ? "Le climat,\nau service du vivant."
                : mode === "register"
                  ? "Une nouvelle façon\nde veiller sur vos plants."
                  : "Retrouver\nvotre accès."}
            </Text>
            <LiquidGlass dark style={st.authPanel}>
              <View style={st.authTabs}>
                <Pressable
                  onPress={() => setMode("login")}
                  style={[st.authTab, mode === "login" && st.authTabActive]}
                >
                  <Text
                    style={[
                      st.authTabText,
                      mode === "login" && st.authTabTextActive,
                    ]}
                  >
                    Connexion
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode("register")}
                  style={[st.authTab, mode === "register" && st.authTabActive]}
                >
                  <Text
                    style={[
                      st.authTabText,
                      mode === "register" && st.authTabTextActive,
                    ]}
                  >
                    Créer un compte
                  </Text>
                </Pressable>
              </View>
              {mode === "register" && (
                <Field
                  icon="person-outline"
                  placeholder="Nom complet"
                  value={form.name}
                  onChangeText={change("name")}
                />
              )}
              <Field
                icon="mail-outline"
                placeholder="Adresse e-mail"
                value={form.email}
                onChangeText={change("email")}
                keyboardType="email-address"
              />
              {mode === "register" && (
                <Field
                  icon="call-outline"
                  placeholder="Téléphone (optionnel)"
                  value={form.phone}
                  onChangeText={change("phone")}
                  keyboardType="phone-pad"
                />
              )}
              <Field
                icon="lock-closed-outline"
                placeholder="Mot de passe"
                value={form.password}
                onChangeText={change("password")}
                secureTextEntry
              />
              {mode === "register" && (
                <Field
                  icon="checkmark-circle-outline"
                  placeholder="Confirmer le mot de passe"
                  value={form.confirm}
                  onChangeText={change("confirm")}
                  secureTextEntry
                />
              )}
              {message ? <Text style={st.authMessage}>{message}</Text> : null}
              <Pressable style={st.authButton} onPress={submit} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={st.authButtonText}>
                      {mode === "register"
                        ? "Créer mon espace"
                        : mode === "forgot"
                          ? "Envoyer le lien"
                          : "Entrer dans ma serre"}
                    </Text>
                    <Icon name="arrow-forward" color="#fff" />
                  </>
                )}
              </Pressable>
              {mode === "login" && (
                <Pressable onPress={() => setMode("forgot")}>
                  <Text style={st.forgot}>Mot de passe oublié ?</Text>
                </Pressable>
              )}
              <View style={st.orRow}>
                <View style={st.orLine} />
                <Text style={st.orText}>OU</Text>
                <View style={st.orLine} />
              </View>
              <Pressable style={st.demoButton} onPress={onDemo}>
                <Icon name="play-circle-outline" color={moss} />
                <Text style={st.demoText}>
                  Explorer avec des données de démonstration
                </Text>
              </Pressable>
            </LiquidGlass>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function Topbar({
  greenhouse,
  onOpen,
  desktop = false,
}: {
  greenhouse: Greenhouse;
  onOpen: () => void;
  desktop?: boolean;
}) {
  const { dark } = useTheme();
  return (
    <View style={[st.topbar, dark && st.topbarDark]}>
      {desktop ? (
        <View>
          <Text style={[st.desktopTopKicker, dark && st.darkMuted]}>
            OBSERVATOIRE CLIMATIQUE
          </Text>
          <Text style={[st.desktopTopTitle, dark && st.darkText]}>
            Goma · Réseau de serres
          </Text>
        </View>
      ) : (
        <BrandMark />
      )}
      <Pressable style={st.greenhouseButton} onPress={onOpen}>
        <LiquidGlass dark={dark} style={StyleSheet.absoluteFill} />
        <View style={st.glassHighlight} />
        <View style={st.online} />
        <View>
          <Text style={[st.greenhouseCaption, dark && { color: "#AFC0B6" }]}>
            SERRE ACTIVE
          </Text>
          <Text
            numberOfLines={1}
            style={[st.greenhouseTopName, dark && { color: "#fff" }]}
          >
            {greenhouse.name}
          </Text>
        </View>
        <Icon name="chevron-down" size={16} color={dark ? "#DCE7E0" : moss} />
      </Pressable>
    </View>
  );
}
function SectionTitle({ overline, title, action, onPress }: any) {
  const { dark } = useTheme();
  return (
    <View style={st.sectionHeader}>
      <View>
        <Text style={[st.overline, dark && { color: "#93A79C" }]}>
          {overline}
        </Text>
        <Text style={[st.sectionTitle, dark && { color: nightText }]}>
          {title}
        </Text>
      </View>
      {action && (
        <Pressable onPress={onPress}>
          <Text style={[st.sectionAction, dark && { color: "#A8C8B5" }]}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
function StatusBarLine({
  value,
  color = moss,
}: {
  value: number;
  color?: string;
}) {
  return (
    <View style={st.barTrack}>
      <View
        style={[
          st.barFill,
          {
            width: `${Math.max(4, Math.min(value, 100))}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function Overview({
  greenhouse,
  measurement,
  alerts,
  refreshing,
  onRefresh,
}: any) {
  const { dark } = useTheme();
  const m = measurement || demoMeasurement;
  const health = Math.round(
    100 -
      Math.max(0, m.air_temperature - 26) * 4 -
      Math.max(0, 50 - m.soil_moisture) * 1.2 -
      Math.max(0, (m.co2 || 0) - 1000) / 30,
  );
  const metrics = [
    [
      "Humidité air",
      `${m.air_humidity.toFixed(0)} %`,
      m.air_humidity,
      "water-outline",
      "#3F7890",
    ],
    [
      "Humidité sol",
      `${m.soil_moisture.toFixed(0)} %`,
      m.soil_moisture,
      "leaf-outline",
      "#557B45",
    ],
    [
      "Lumière",
      `${m.luminosity.toFixed(0)} lx`,
      Math.min(100, m.luminosity / 10),
      "sunny-outline",
      "#C68B2C",
    ],
    [
      "CO₂",
      `${(m.co2 || 0).toFixed(0)} ppm`,
      Math.min(100, (m.co2 || 0) / 12),
      "cloud-outline",
      "#746788",
    ],
  ];
  return (
    <ScrollView
      style={dark && st.screenDark}
      contentContainerStyle={[st.page, dark && st.pageDark]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={dark ? "#fff" : moss}
        />
      }
    >
      <View style={st.editorialHero}>
        <View style={st.heroCopy}>
          <Text style={st.overlineLight}>
            INDICE MICROCLIMATIQUE · TEMPS RÉEL
          </Text>
          <Text style={st.heroTitle}>
            {health >= 85
              ? "Tout pousse\ncomme prévu."
              : health >= 65
                ? "Un réglage\nest conseillé."
                : "Intervention\nnécessaire."}
          </Text>
          <Text style={st.heroSub}>
            {dateLabel(m.recorded_at)} · actualisation capteurs
          </Text>
        </View>
        <View style={st.healthSeal}>
          <Text style={st.healthNumber}>{health}</Text>
          <Text style={st.healthUnit}>/100</Text>
          <Text style={st.healthWord}>SANTÉ</Text>
        </View>
      </View>
      <View style={[st.temperatureBlock, dark && st.darkPanel]}>
        <View>
          <Text style={[st.measureLabel, dark && st.darkMuted]}>
            TEMPÉRATURE DE L’AIR
          </Text>
          <View style={st.tempRow}>
            <Text style={[st.temperature, dark && st.darkText]}>
              {m.air_temperature.toFixed(1).replace(".", ",")}
            </Text>
            <Text style={st.degree}>°C</Text>
          </View>
          <Text style={[st.range, dark && st.darkMuted]}>
            Zone recommandée 18–26 °C
          </Text>
        </View>
        <View style={st.tempVisual}>
          {[12, 26, 38, 52, 45, 64, 58, 74, 68, 80].map((h, i) => (
            <View
              key={i}
              style={[
                st.tempStem,
                {
                  height: h,
                  opacity: 0.2 + i * 0.07,
                  backgroundColor: i > 7 ? strawberry : moss,
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={[st.metricStrip, dark && st.darkPanel]}>
        {metrics.map((x) => (
          <View key={x[0]} style={[st.metricItem, dark && st.darkBorder]}>
            <View style={st.metricTop}>
              <Icon name={x[3]} color={x[4]} size={18} />
              <Text style={[st.metricName, dark && st.darkMuted]}>{x[0]}</Text>
            </View>
            <Text style={[st.metricNumber, dark && st.darkText]}>{x[1]}</Text>
            <StatusBarLine value={x[2]} color={x[4]} />
          </View>
        ))}
      </View>
      <SectionTitle
        overline="DÉCISION ASSISTÉE"
        title="Ce que KivuSense recommande"
      />
      <View style={[st.recommendation, dark && st.darkPanel]}>
        <View style={st.recIndex}>
          <Text style={st.recIndexText}>01</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.recTitle, dark && st.darkText]}>
            Arrosage court en fin de journée
          </Text>
          <Text style={[st.recBody, dark && st.darkMuted]}>
            Le sol baisse régulièrement depuis midi. Un cycle de 8 à 12 minutes
            préservera l’humidité sans saturer les racines.
          </Text>
          <View style={st.recTags}>
            <Text style={st.recTag}>À faire avant 19 h</Text>
            <Text style={st.recTag}>≈ 18 L</Text>
          </View>
        </View>
      </View>
      <SectionTitle
        overline="SIGNAL"
        title="Alertes à traiter"
        action={`${alerts.filter((a: any) => !a.resolved).length} ouverte(s)`}
      />
      {alerts.length ? (
        alerts.slice(0, 2).map((a: any) => (
          <View key={a.id} style={[st.signalRow, dark && st.darkPanel]}>
            <View
              style={[
                st.signalMark,
                { backgroundColor: a.resolved ? "#B8C5BC" : strawberry },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[st.signalTitle, dark && st.darkText]}>
                {a.title}
              </Text>
              <Text style={[st.signalText, dark && st.darkMuted]}>
                {a.message}
              </Text>
            </View>
            <Text style={[st.signalTime, dark && st.darkMuted]}>
              {dateLabel(a.created_at)}
            </Text>
          </View>
        ))
      ) : (
        <Empty text="Aucune alerte. La serre est stable." />
      )}
      <Text style={st.serreFooter}>
        {greenhouse.variety || "Fraise"} · {greenhouse.location || "Goma"}
      </Text>
    </ScrollView>
  );
}

function Analysis({ data }: { data: Measurement[] }) {
  const { dark } = useTheme();
  const points = data.length
    ? data.slice(0, 12).reverse()
    : Array.from({ length: 12 }, (_, i) => ({
        ...demoMeasurement,
        id: i,
        air_temperature: 20 + Math.sin(i / 2) * 3 + i * 0.25,
        soil_moisture: 66 - i * 1.4,
        recorded_at: new Date(Date.now() - (11 - i) * 36e5).toISOString(),
      }));
  const avg = points.reduce((s, x) => s + x.air_temperature, 0) / points.length;
  return (
    <ScrollView
      style={dark && st.screenDark}
      contentContainerStyle={[st.page, dark && st.pageDark]}
    >
      <SectionTitle overline="ANALYSE" title="Lire la serre dans le temps" />
      <View style={st.periodRow}>
        {["24 heures", "7 jours", "30 jours"].map((p, i) => (
          <Pressable
            key={p}
            style={[
              st.period,
              dark && st.darkBorder,
              i === 0 && st.periodActive,
            ]}
          >
            <Text
              style={[
                st.periodText,
                dark && st.darkText,
                i === 0 && st.periodTextActive,
              ]}
            >
              {p}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[st.bigChart, dark && st.darkPanel]}>
        <View style={st.chartHeader}>
          <View>
            <Text style={[st.chartLabel, dark && st.darkMuted]}>
              TEMPÉRATURE MOYENNE
            </Text>
            <Text style={[st.chartMain, dark && st.darkText]}>
              {avg.toFixed(1).replace(".", ",")} °C
            </Text>
          </View>
          <Text style={st.chartDelta}>+1,2 °C</Text>
        </View>
        <View style={[st.chartArea, dark && st.darkBorder]}>
          {points.map((p, i) => {
            const h = Math.max(16, (p.air_temperature - 15) * 8);
            return (
              <View key={p.id + i} style={st.chartColumn}>
                <View style={[st.chartPoint, { bottom: h }]} />
                <View style={[st.chartStroke, { height: h }]} />
              </View>
            );
          })}
        </View>
        <View style={st.axis}>
          {["00 h", "06 h", "12 h", "Maint."].map((x) => (
            <Text key={x} style={dark && st.darkMuted}>
              {x}
            </Text>
          ))}
        </View>
      </View>
      <View style={[st.statsBand, dark && st.darkPanel]}>
        {[
          ["18,7 °C", "MINIMUM"],
          ["23,1 °C", "MOYENNE"],
          ["28,2 °C", "MAXIMUM"],
        ].map((x) => (
          <View key={x[1]}>
            <Text style={[st.statValue, dark && st.darkText]}>{x[0]}</Text>
            <Text style={[st.statLabel, dark && st.darkMuted]}>{x[1]}</Text>
          </View>
        ))}
      </View>
      <SectionTitle overline="COMPARAISON" title="Équilibre des paramètres" />
      <View style={[st.balance, dark && st.darkPanel]}>
        {[
          ["Humidité du sol", 58, "Cible 55–70 %"],
          ["Humidité de l’air", 71, "Cible 60–80 %"],
          ["Réservoir", 68, "Autonomie 3 jours"],
        ].map((x) => (
          <View key={x[0]} style={[st.balanceRow, dark && st.darkBorder]}>
            <View style={st.balanceLabels}>
              <Text style={[st.balanceName, dark && st.darkText]}>{x[0]}</Text>
              <Text style={[st.balanceHint, dark && st.darkMuted]}>{x[2]}</Text>
            </View>
            <Text style={[st.balanceValue, dark && { color: "#9DC5AE" }]}>
              {x[1]} %
            </Text>
            <StatusBarLine value={x[1] as number} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Actions({
  automatic,
  setAutomatic,
  equipment,
  setEquipment,
  onSave,
}: any) {
  const { dark } = useTheme();
  const toggle = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEquipment((items: Equipment[]) =>
      items.map((x) => (x.key === key ? { ...x, on: !x.on } : x)),
    );
  };
  return (
    <ScrollView
      style={dark && st.screenDark}
      contentContainerStyle={[st.page, dark && st.pageDark]}
    >
      <SectionTitle overline="PILOTAGE" title="Agir sans perdre le contrôle" />
      <View
        style={[
          st.modeBlock,
          dark && st.darkPanel,
          automatic && st.modeBlockOn,
        ]}
      >
        <View>
          <Text
            style={[
              st.modeOver,
              dark && st.darkMuted,
              automatic && { color: "#BDD2C4" },
            ]}
          >
            MODE DE CONDUITE
          </Text>
          <Text
            style={[
              st.modeTitle,
              dark && st.darkText,
              automatic && { color: "#fff" },
            ]}
          >
            {automatic ? "Automatique" : "Manuel"}
          </Text>
          <Text
            style={[
              st.modeDescription,
              dark && st.darkMuted,
              automatic && { color: "#C8D8CE" },
            ]}
          >
            {automatic
              ? "Les règles climatiques décident et consignent chaque action."
              : "Vous commandez chaque équipement directement."}
          </Text>
        </View>
        <Switch
          value={automatic}
          onValueChange={setAutomatic}
          trackColor={{ false: "#D5D3CC", true: "#5D7D70" }}
          thumbColor="#fff"
        />
      </View>
      <Text style={[st.actionNote, dark && st.darkMuted]}>
        {automatic
          ? "Les commandes restent visibles, mais sont verrouillées tant que le mode automatique est actif."
          : "Chaque commande est envoyée immédiatement au contrôleur ESP32."}
      </Text>
      {equipment.map((e: Equipment, i: number) => (
        <Pressable
          key={e.key}
          disabled={automatic}
          onPress={() => toggle(e.key)}
          style={[
            st.equipmentRow,
            dark && st.darkPanel,
            i === 0 && {
              borderTopWidth: 1,
              borderTopColor: dark ? nightLine : line,
            },
          ]}
        >
          <View style={[st.equipmentIcon, e.on && { backgroundColor: moss }]}>
            <Icon name={e.icon} color={e.on ? "#fff" : moss} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.equipmentName, dark && st.darkText]}>
              {e.name}
            </Text>
            <Text style={[st.equipmentSub, dark && st.darkMuted]}>
              {e.subtitle}
            </Text>
          </View>
          <View style={[st.statePill, e.on && st.statePillOn]}>
            <Text style={[st.stateText, e.on && { color: "#fff" }]}>
              {e.on ? "ACTIF" : "ARRÊT"}
            </Text>
          </View>
        </Pressable>
      ))}
      {!automatic && (
        <Pressable style={st.darkButton} onPress={onSave}>
          <Text style={st.darkButtonText}>Envoyer les commandes</Text>
          <Icon name="paper-plane-outline" color="#fff" />
        </Pressable>
      )}
      <SectionTitle overline="RÈGLES" title="Seuils de la variété" />
      <View style={[st.thresholdGrid, dark && st.darkPanel]}>
        {[
          ["Temp. max", "28 °C"],
          ["Sol min.", "50 %"],
          ["CO₂ max", "1 000 ppm"],
          ["Eau min.", "25 %"],
        ].map((x) => (
          <Pressable key={x[0]} style={[st.threshold, dark && st.darkBorder]}>
            <Text style={[st.thresholdName, dark && st.darkMuted]}>{x[0]}</Text>
            <Text style={[st.thresholdValue, dark && st.darkText]}>{x[1]}</Text>
            <Icon
              name="create-outline"
              size={15}
              color={dark ? "#A8B8AF" : "#7B817D"}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Journal({
  alerts,
  onResolve,
}: {
  alerts: ApiAlert[];
  onResolve: (id: number) => void;
}) {
  const { dark } = useTheme();
  const events = alerts.length ? alerts : demoAlerts;
  return (
    <ScrollView
      style={dark && st.screenDark}
      contentContainerStyle={[st.page, dark && st.pageDark]}
    >
      <SectionTitle overline="JOURNAL" title="Une trace de chaque décision" />
      <Text style={[st.intro, dark && st.darkMuted]}>
        Mesures, alertes et actions automatiques sont conservées pour expliquer
        le comportement de la serre.
      </Text>
      {events.map((a, i) => (
        <View key={a.id + i} style={st.logRow}>
          <View style={st.logRail}>
            <View
              style={[
                st.logDot,
                { backgroundColor: a.resolved ? moss : strawberry },
              ]}
            />
            {i < events.length - 1 && (
              <View
                style={[st.logLine, dark && { backgroundColor: nightLine }]}
              />
            )}
          </View>
          <View style={st.logContent}>
            <Text style={[st.logDate, dark && st.darkMuted]}>
              {dateLabel(a.created_at)}
            </Text>
            <Text style={[st.logTitle, dark && st.darkText]}>{a.title}</Text>
            <Text style={[st.logBody, dark && st.darkMuted]}>{a.message}</Text>
            {!a.resolved && (
              <Pressable onPress={() => onResolve(a.id)}>
                <Text style={st.resolve}>Marquer comme traitée →</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Account({
  user,
  greenhouses,
  demo,
  onReport,
  onAdd,
  onLogout,
  dark,
  onToggleTheme,
  onProvision,
}: any) {
  return (
    <ScrollView
      style={dark && st.screenDark}
      contentContainerStyle={[st.page, dark && st.pageDark]}
    >
      <SectionTitle
        overline="ESPACE AGRICULTEUR"
        title="Compte & exploitation"
      />
      <View style={[st.identity, dark && st.darkPanel]}>
        <Text style={st.initials}>
          {user.full_name
            .split(" ")
            .map((x: string) => x[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </Text>
        <View>
          <Text style={[st.identityName, dark && st.darkText]}>
            {user.full_name}
          </Text>
          <Text style={[st.identityEmail, dark && st.darkMuted]}>
            {user.email}
          </Text>
          <Text style={st.identityRole}>
            {demo ? "SESSION DE DÉMONSTRATION" : "PROPRIÉTAIRE"}
          </Text>
        </View>
      </View>
      <SectionTitle
        overline="EXPLOITATION"
        title={`${greenhouses.length} serre${greenhouses.length > 1 ? "s" : ""}`}
        action="Ajouter"
        onPress={onAdd}
      />
      {greenhouses.map((g: Greenhouse) => (
        <View style={[st.accountGreenhouse, dark && st.darkPanel]} key={g.id}>
          <View style={st.miniPhoto}>
            <Icon name="leaf" color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.accountGhName, dark && st.darkText]}>
              {g.name}
            </Text>
            <Text style={[st.accountGhMeta, dark && st.darkMuted]}>
              {g.variety || "Fraise"} ·{" "}
              {g.location || "Localisation non définie"}
            </Text>
            <Pressable onPress={() => onProvision(g.id)} style={st.deviceLink}>
              <Icon
                name="hardware-chip-outline"
                size={12}
                color={dark ? "#A9D5B9" : moss}
              />
              <Text style={[st.deviceLinkText, dark && { color: "#A9D5B9" }]}>
                Connecter l’ESP32
              </Text>
            </Pressable>
          </View>
          <Icon name="chevron-forward" color={dark ? "#A8B8AF" : "#777"} />
        </View>
      ))}
      <SectionTitle overline="APPARENCE" title="Ambiance de travail" />
      <View style={[st.themeChoice, dark && st.darkPanel]}>
        <View style={st.themeOrb}>
          <Icon
            name={dark ? "moon" : "sunny"}
            color={dark ? "#DCE7E0" : moss}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.menuTitle, dark && st.darkText]}>Mode sombre</Text>
          <Text style={[st.menuSub, dark && st.darkMuted]}>
            Confort visuel de nuit et en serre
          </Text>
        </View>
        <Switch
          value={dark}
          onValueChange={onToggleTheme}
          trackColor={{ false: "#C8CDC8", true: "#4D725F" }}
          thumbColor="#fff"
        />
      </View>
      <SectionTitle overline="DOCUMENTS" title="Rapports & données" />
      <Pressable style={[st.menuRow, dark && st.darkPanel]} onPress={onReport}>
        <Icon name="document-text-outline" color={dark ? "#9DC5AE" : moss} />
        <View style={{ flex: 1 }}>
          <Text style={[st.menuTitle, dark && st.darkText]}>
            Rapport climatique PDF
          </Text>
          <Text style={[st.menuSub, dark && st.darkMuted]}>
            Mesures, alertes et recommandations
          </Text>
        </View>
        <Icon name="download-outline" color={dark ? "#9DC5AE" : moss} />
      </Pressable>
      <Pressable style={[st.menuRow, dark && st.darkPanel]}>
        <Icon name="cloud-done-outline" color={dark ? "#9DC5AE" : moss} />
        <View style={{ flex: 1 }}>
          <Text style={[st.menuTitle, dark && st.darkText]}>
            Synchronisation cloud
          </Text>
          <Text style={[st.menuSub, dark && st.darkMuted]}>
            Activée · dernière sauvegarde à l’instant
          </Text>
        </View>
        <View style={st.online} />
      </Pressable>
      <Pressable style={st.logout} onPress={onLogout}>
        <Icon name="log-out-outline" color={strawberry} />
        <Text style={st.logoutText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Icon name="checkmark-circle-outline" color={moss} />
      <Text style={st.emptyText}>{text}</Text>
    </View>
  );
}

function GreenhouseModal({
  visible,
  greenhouses,
  selected,
  onClose,
  onSelect,
  onAdd,
}: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={st.modalShade} onPress={onClose} />
      <View style={st.sheet}>
        <View style={st.sheetHandle} />
        <Text style={st.sheetEyebrow}>VOS ESPACES</Text>
        <Text style={st.sheetTitle}>Choisir une serre</Text>
        {greenhouses.map((g: Greenhouse) => (
          <Pressable
            key={g.id}
            onPress={() => onSelect(g)}
            style={[
              st.sheetGreenhouse,
              selected?.id === g.id && st.sheetGreenhouseActive,
            ]}
          >
            <View style={st.sheetIcon}>
              <Icon name="leaf" color={selected?.id === g.id ? "#fff" : moss} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sheetGhName}>{g.name}</Text>
              <Text style={st.sheetGhMeta}>
                {g.variety || "Fraise"} · {g.location || "Goma"}
              </Text>
            </View>
            {selected?.id === g.id && (
              <Icon name="checkmark-circle" color={moss} />
            )}
          </Pressable>
        ))}
        <Pressable style={st.addGreenhouse} onPress={onAdd}>
          <Icon name="add" color={moss} />
          <Text style={st.addGreenhouseText}>Ajouter une serre</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function AddModal({ visible, onClose, onSubmit }: any) {
  const [form, setForm] = useState({
    name: "",
    location: "Goma",
    variety: "Albion",
    photo_url: "",
  });
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!r.canceled) setForm((v) => ({ ...v, photo_url: r.assets[0].uri }));
  };
  const save = async () => {
    if (!form.name.trim())
      return Alert.alert("Nom requis", "Donne un nom à la serre.");
    setBusy(true);
    await onSubmit(form);
    setBusy(false);
  };
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={st.formModal}>
        <View style={st.formHeader}>
          <Pressable onPress={onClose}>
            <Icon name="close" size={26} />
          </Pressable>
          <Text style={st.formTitle}>Nouvelle serre</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={st.formBody}>
          <Text style={st.formLead}>
            Identifie cet espace comme tu le fais sur le terrain.
          </Text>
          <Pressable style={st.photoPicker} onPress={pick}>
            <Icon name="camera-outline" color={moss} size={28} />
            <Text style={st.photoPickerText}>
              {form.photo_url
                ? "Photo sélectionnée"
                : "Ajouter une photo de la serre"}
            </Text>
          </Pressable>
          <Field
            icon="leaf-outline"
            placeholder="Nom de la serre"
            value={form.name}
            onChangeText={(x: string) => setForm((v) => ({ ...v, name: x }))}
          />
          <Field
            icon="location-outline"
            placeholder="Localisation"
            value={form.location}
            onChangeText={(x: string) =>
              setForm((v) => ({ ...v, location: x }))
            }
          />
          <Field
            icon="nutrition-outline"
            placeholder="Variété de fraise"
            value={form.variety}
            onChangeText={(x: string) => setForm((v) => ({ ...v, variety: x }))}
          />
          <Pressable style={st.darkButton} onPress={save}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={st.darkButtonText}>Créer la serre</Text>
                <Icon name="arrow-forward" color="#fff" />
              </>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Shell({
  user,
  demo,
  onLogout,
}: {
  user: User;
  demo: boolean;
  onLogout: () => void;
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 980;
  const [tab, setTab] = useState<Tab>("Vue"),
    [greenhouses, setGreenhouses] = useState<Greenhouse[]>(
      demo ? demoGreenhouses : [],
    ),
    [selected, setSelected] = useState<Greenhouse | null>(
      demo ? demoGreenhouses[0] : null,
    );
  const [measurement, setMeasurement] = useState<Measurement | null>(
      demo ? demoMeasurement : null,
    ),
    [history, setHistory] = useState<Measurement[]>([]),
    [alerts, setAlerts] = useState<ApiAlert[]>(demo ? demoAlerts : []),
    [equipment, setEquipment] = useState(initialEquipment),
    [automatic, setAutomatic] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [selector, setSelector] = useState(false),
    [adding, setAdding] = useState(false);
  const [online, setOnline] = useState(true),
    [dark, setDark] = useState(false);
  const screenMotion = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    AsyncStorage.getItem("kivusense.theme").then((value) => {
      const enabled = value === "dark";
      setDark(enabled);
      SystemUI.setBackgroundColorAsync(enabled ? night : paper).catch(() => {});
    });
  }, []);
  const toggleTheme = async (value: boolean) => {
    setDark(value);
    await AsyncStorage.setItem("kivusense.theme", value ? "dark" : "light");
    SystemUI.setBackgroundColorAsync(value ? night : paper).catch(() => {});
    Haptics.selectionAsync();
  };
  useEffect(() => {
    const check = () =>
      Network.getNetworkStateAsync()
        .then((n) =>
          setOnline(Boolean(n.isConnected && n.isInternetReachable !== false)),
        )
        .catch(() => setOnline(false));
    check();
    const timer = setInterval(check, 12000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    screenMotion.setValue(0);
    Animated.spring(screenMotion, {
      toValue: 1,
      useNativeDriver: true,
      damping: 19,
      stiffness: 180,
      mass: 0.75,
    }).start();
  }, [tab]);
  const load = async (gh?: Greenhouse | null) => {
    const active = gh || selected;
    if (demo || !active) return;
    setRefreshing(true);
    try {
      const [m, h, a, act] = await Promise.all([
        api.latest(active.id).catch(() => null),
        api.history(active.id, 100),
        api.alerts(active.id),
        api.actuators(active.id),
      ]);
      setMeasurement(m);
      setHistory(h);
      setAlerts(a);
      if (act) setEquipment((v) => v.map((e) => ({ ...e, on: act[e.key] })));
    } catch (e: any) {
      Alert.alert("Synchronisation impossible", e.message);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (demo) return;
    api
      .greenhouses()
      .then((gs) => {
        setGreenhouses(gs);
        const first = gs[0] || null;
        setSelected(first);
        if (first) load(first);
      })
      .catch((e) =>
        Alert.alert("API inaccessible", `${e.message}\n${API_URL}`),
      );
  }, []);
  const choose = (g: Greenhouse) => {
    Haptics.selectionAsync();
    setSelected(g);
    setAutomatic(g.automatic_mode);
    setSelector(false);
    load(g);
  };
  const add = async (form: any) => {
    try {
      const g = demo
        ? { ...demoGreenhouses[0], ...form, id: Date.now() }
        : await api.createGreenhouse(form);
      setGreenhouses((v) => [...v, g]);
      setSelected(g);
      setAdding(false);
      setSelector(false);
    } catch (e: any) {
      Alert.alert("Création impossible", e.message);
    }
  };
  const saveEquipment = async () => {
    if (!selected) return;
    try {
      if (!demo)
        await api.updateActuators(
          selected.id,
          Object.fromEntries(equipment.map((e) => [e.key, e.on])) as any,
        );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Commande transmise",
        "Le nouvel état a été envoyé au contrôleur.",
      );
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Commande refusée", e.message);
    }
  };
  const changeAutomatic = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAutomatic(value);
    if (!selected || demo) return;
    try {
      const updated = await api.updateMode(selected.id, value);
      setSelected(updated);
      setGreenhouses((v) => v.map((g) => (g.id === updated.id ? updated : g)));
    } catch (e: any) {
      setAutomatic(!value);
      Alert.alert("Mode non modifié", e.message);
    }
  };
  const resolve = async (id: number) => {
    if (selected && !demo) await api.resolveAlert(selected.id, id);
    setAlerts((v) =>
      v.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    );
  };
  const report = async () => {
    const m = measurement || demoMeasurement;
    const html = `<html><body style="font-family:Arial;padding:40px;color:#17231E"><h1 style="color:#123E32">Rapport climatique KivuSense</h1><p>${selected?.name || "Serre"} · ${selected?.location || "Goma"}</p><hr/><h2>État climatique</h2><p>Température : <b>${m.air_temperature} °C</b></p><p>Humidité de l'air : <b>${m.air_humidity} %</b></p><p>Humidité du sol : <b>${m.soil_moisture} %</b></p><p>CO₂ : <b>${m.co2 || "N/D"} ppm</b></p><h2>Recommandation</h2><p>Maintenir un cycle d'irrigation court en fin de journée et vérifier le niveau du réservoir.</p><p style="margin-top:60px;color:#777">Généré le ${new Date().toLocaleDateString("fr-FR")} par KivuSense · Goma.</p></body></html>`;
    const f = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(f.uri);
  };
  const provision = async (greenhouseId: number) => {
    if (demo) {
      Alert.alert(
        "Mode démonstration",
        "La clé ESP32 sera disponible après la création d’une vraie serre connectée à l’API.",
      );
      return;
    }
    try {
      const result = await api.provisioning(greenhouseId);
      Alert.alert(
        "Clé de l’ESP32",
        `${result.device_key}\n\nCopie cette clé dans KivuSense_ESP32.ino, dans DEVICE_KEY.`,
      );
    } catch (e: any) {
      Alert.alert("Clé indisponible", e.message);
    }
  };
  if (!selected)
    return (
      <ThemeContext.Provider value={{ dark, toggle: () => toggleTheme(!dark) }}>
        <SafeAreaView style={[st.noGreenhouse, dark && st.safeDark]}>
          <BrandMark />
          <Icon name="leaf-outline" size={52} color={sage} />
          <Text style={[st.noGhTitle, dark && st.darkText]}>
            Commençons par ta première serre.
          </Text>
          <Text style={[st.noGhText, dark && st.darkMuted]}>
            Ajoute son nom, sa localisation et la variété cultivée.
          </Text>
          <Pressable style={st.darkButton} onPress={() => setAdding(true)}>
            <Text style={st.darkButtonText}>Ajouter ma serre</Text>
          </Pressable>
          <AddModal
            visible={adding}
            onClose={() => setAdding(false)}
            onSubmit={add}
          />
        </SafeAreaView>
      </ThemeContext.Provider>
    );
  const screen =
    tab === "Vue" ? (
      <Overview
        greenhouse={selected}
        measurement={measurement}
        alerts={alerts}
        refreshing={refreshing}
        onRefresh={() => load()}
      />
    ) : tab === "Analyse" ? (
      <Analysis data={history} />
    ) : tab === "Actions" ? (
      <Actions
        automatic={automatic}
        setAutomatic={changeAutomatic}
        equipment={equipment}
        setEquipment={setEquipment}
        onSave={saveEquipment}
      />
    ) : tab === "Journal" ? (
      <Journal alerts={alerts} onResolve={resolve} />
    ) : (
      <Account
        user={user}
        greenhouses={greenhouses}
        demo={demo}
        dark={dark}
        onToggleTheme={toggleTheme}
        onProvision={provision}
        onReport={report}
        onAdd={() => setAdding(true)}
        onLogout={onLogout}
      />
    );
  const nav: [Tab, string][] = [
    ["Vue", "compass-outline"],
    ["Analyse", "analytics-outline"],
    ["Actions", "options-outline"],
    ["Journal", "time-outline"],
    ["Compte", "person-outline"],
  ];
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => toggleTheme(!dark) }}>
      <SafeAreaView
        style={[st.safe, dark && st.safeDark, desktop && st.webFrame]}
      >
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={dark ? night : paper}
        />
        {desktop && (
          <View style={[st.webRail, dark && st.webRailDark]}>
            <BrandMark />
            <Text style={[st.webRailKicker, dark && st.darkMuted]}>
              CLIMATE INTELLIGENCE · GOMA
            </Text>
            <View style={st.webRailNav}>
              {nav.map(([name, icon]) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTab(name);
                  }}
                  style={[
                    st.webRailItem,
                    tab === name && st.webRailItemActive,
                    dark && tab === name && st.webRailItemActiveDark,
                  ]}
                >
                  <Icon
                    name={tab === name ? icon.replace("-outline", "") : icon}
                    color={
                      tab === name
                        ? dark
                          ? "#D5EBDD"
                          : moss
                        : dark
                          ? "#84978D"
                          : "#7A827D"
                    }
                    size={21}
                  />
                  <Text
                    style={[
                      st.webRailText,
                      dark && st.darkMuted,
                      tab === name && st.webRailTextActive,
                      dark && tab === name && { color: "#fff" },
                    ]}
                  >
                    {name}
                  </Text>
                  {tab === name && <View style={st.webRailSignal} />}
                </Pressable>
              ))}
            </View>
            <View style={[st.webRailStatus, dark && st.darkPanel]}>
              <View style={st.online} />
              <View>
                <Text style={[st.webRailStatusTitle, dark && st.darkText]}>
                  Système connecté
                </Text>
                <Text style={[st.webRailStatusSub, dark && st.darkMuted]}>
                  ESP32 · API · Cloud
                </Text>
              </View>
            </View>
          </View>
        )}
        <View style={[st.webMain, dark && st.safeDark]}>
          <Topbar
            greenhouse={selected}
            onOpen={() => setSelector(true)}
            desktop={desktop}
          />
          {!online && (
            <View style={st.offlineBanner}>
              <Icon name="cloud-offline-outline" color="#fff" size={15} />
              <Text style={st.offlineText}>
                Hors connexion · dernières données conservées
              </Text>
            </View>
          )}
          <Animated.View
            style={[
              {
                flex: 1,
                opacity: screenMotion,
                transform: [
                  {
                    translateY: screenMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [9, 0],
                    }),
                  },
                ],
              },
              desktop && st.webContent,
            ]}
          >
            {screen}
          </Animated.View>
          {!desktop && (
            <LiquidGlass
              dark={dark}
              style={[st.bottomNav, dark && st.bottomNavDark]}
            >
              {nav.map(([name, icon]) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTab(name);
                  }}
                  style={st.navItem}
                >
                  {tab === name && (
                    <View
                      style={[st.navGlassHalo, dark && st.navGlassHaloDark]}
                    />
                  )}
                  <Icon
                    name={tab === name ? icon.replace("-outline", "") : icon}
                    color={
                      tab === name
                        ? dark
                          ? "#B7D6C2"
                          : moss
                        : dark
                          ? "#7D9186"
                          : "#8B918D"
                    }
                    size={20}
                  />
                  <Text
                    style={[
                      st.navText,
                      dark && st.darkMuted,
                      tab === name && st.navTextActive,
                      dark && tab === name && { color: "#B7D6C2" },
                    ]}
                  >
                    {name}
                  </Text>
                  {tab === name && <View style={st.navIndicator} />}
                </Pressable>
              ))}
            </LiquidGlass>
          )}
          <GreenhouseModal
            visible={selector}
            greenhouses={greenhouses}
            selected={selected}
            onClose={() => setSelector(false)}
            onSelect={choose}
            onAdd={() => setAdding(true)}
          />
          <AddModal
            visible={adding}
            onClose={() => setAdding(false)}
            onSubmit={add}
          />
        </View>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    session
      .token()
      .then((t) =>
        t
          ? api
              .me()
              .then(setUser)
              .catch(() => session.clear())
          : null,
      )
      .finally(() => setLoading(false));
  }, []);
  const logout = async () => {
    await session.clear();
    setUser(null);
    setDemo(false);
  };
  if (loading)
    return (
      <View style={st.loader}>
        <BrandMark />
        <ActivityIndicator color={moss} />
      </View>
    );
  return user ? (
    <Shell user={user} demo={demo} onLogout={logout} />
  ) : (
    <Auth
      onAuthenticated={(u) => {
        setDemo(false);
        setUser(u);
      }}
      onDemo={() => {
        setDemo(true);
        setUser(demoUser);
      }}
    />
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paper },
  webFrame: { flexDirection: "row" },
  webMain: { flex: 1, minWidth: 0, backgroundColor: paper },
  webContent: { width: "100%", maxWidth: 1180, alignSelf: "center" },
  webRail: {
    width: 246,
    padding: 24,
    paddingTop: 30,
    backgroundColor: "#EAE7DF",
    borderRightWidth: 1,
    borderRightColor: line,
  },
  webRailDark: { backgroundColor: "#101D17", borderRightColor: nightLine },
  webRailKicker: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#7B847E",
    marginTop: 12,
  },
  webRailNav: { marginTop: 45, gap: 8 },
  webRailItem: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: 15,
    position: "relative",
  },
  webRailItemActive: {
    backgroundColor: "rgba(255,255,255,.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
  },
  webRailItemActiveDark: {
    backgroundColor: "rgba(76,115,94,.22)",
    borderColor: "rgba(179,211,192,.12)",
  },
  webRailText: { fontSize: 12, color: "#707973", fontWeight: "700" },
  webRailTextActive: { color: moss, fontWeight: "900" },
  webRailSignal: {
    position: "absolute",
    right: 12,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: strawberry,
  },
  webRailStatus: {
    marginTop: "auto",
    padding: 14,
    backgroundColor: "rgba(255,255,255,.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.8)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webRailStatusTitle: { fontSize: 10, color: ink, fontWeight: "900" },
  webRailStatusSub: { fontSize: 8, color: "#7B847E", marginTop: 3 },
  safeDark: { backgroundColor: night },
  screenDark: { backgroundColor: night },
  pageDark: { backgroundColor: night },
  darkPanel: { backgroundColor: nightSurface, borderColor: nightLine },
  darkText: { color: nightText },
  darkMuted: { color: "#9EADA5" },
  darkBorder: { borderColor: nightLine },
  loader: {
    flex: 1,
    backgroundColor: paper,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  page: { paddingHorizontal: 20, paddingBottom: 42 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandGlyph: {
    width: 32,
    height: 32,
    backgroundColor: "#102A22",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(126,202,176,.38)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
  },
  brandGlyphLight: { borderWidth: 1, borderColor: "rgba(255,255,255,.4)" },
  senseOrbit: {
    position: "absolute",
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#78C7AA",
  },
  senseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#78C7AA",
  },
  senseSignal: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: strawberry,
    right: 3,
    top: 3,
    borderWidth: 1,
    borderColor: "#102A22",
  },
  brandName: {
    fontSize: 17,
    fontWeight: "900",
    color: ink,
    letterSpacing: -0.7,
  },
  brandSignature: {
    fontSize: 5,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#75827B",
    marginTop: 1,
  },
  authBg: { flex: 1 },
  authSafe: { flex: 1 },
  authTop: {
    paddingHorizontal: 22,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationPill: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: "rgba(17,34,27,.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    overflow: "hidden",
  },
  locationText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  authContent: { padding: 20, paddingTop: 148 },
  authContentDesktop: {
    width: 530,
    alignSelf: "flex-end",
    marginRight: 70,
    paddingTop: 80,
    paddingBottom: 42,
  },
  authTelemetry: { flexDirection: "row", gap: 7, marginBottom: 13 },
  telemetryPill: {
    minHeight: 31,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.22)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#75D397",
  },
  telemetryText: {
    fontSize: 7,
    color: "#E5EEE8",
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  telemetryValue: { fontSize: 11, color: "#fff", fontWeight: "900" },
  authKicker: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#DDE7E0",
    marginBottom: 8,
  },
  authHeadline: {
    fontSize: 43,
    lineHeight: 45,
    fontWeight: "500",
    letterSpacing: -1.7,
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    marginBottom: 22,
  },
  authPanel: {
    backgroundColor: "rgba(12,27,21,.52)",
    borderRadius: 27,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
  },
  authTabs: {
    flexDirection: "row",
    padding: 3,
    backgroundColor: "rgba(233,236,231,.92)",
    borderRadius: 13,
    marginBottom: 17,
  },
  authTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  authTabActive: { backgroundColor: "#fff" },
  authTabText: { fontSize: 12, fontWeight: "700", color: "#7E8580" },
  authTabTextActive: { color: ink },
  field: {
    height: 51,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.65)",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,.94)",
  },
  input: { flex: 1, color: ink, fontSize: 14, marginLeft: 10 },
  fieldError: { fontSize: 10, color: "#FF8993", marginTop: 4 },
  authMessage: {
    fontSize: 11,
    lineHeight: 16,
    color: "#FFABB1",
    marginTop: 10,
  },
  authButton: {
    height: 53,
    borderRadius: 14,
    backgroundColor: "#2A624B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 15,
  },
  authButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  forgot: {
    textAlign: "center",
    color: "#C9E2D2",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 13,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  orLine: { height: 1, backgroundColor: "rgba(255,255,255,.22)", flex: 1 },
  orText: { fontSize: 8, fontWeight: "900", color: "#C2CEC6" },
  demoButton: {
    height: 45,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.3)",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,.88)",
  },
  demoText: { fontSize: 11, fontWeight: "700", color: moss },
  topbar: {
    height: 67,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1D9",
  },
  topbarDark: { backgroundColor: night, borderBottomColor: nightLine },
  desktopTopKicker: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#7B847E",
  },
  desktopTopTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: ink,
    marginTop: 3,
  },
  greenhouseButton: {
    maxWidth: "55%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.72)",
    shadowColor: "#17231E",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  glassHighlight: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 2,
    height: 1,
    backgroundColor: "rgba(255,255,255,.82)",
  },
  online: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#55A874" },
  greenhouseCaption: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#7B847E",
  },
  greenhouseTopName: {
    fontSize: 11,
    fontWeight: "800",
    color: ink,
    maxWidth: 105,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 27,
    marginBottom: 15,
  },
  overline: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#7D847F",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    color: ink,
    letterSpacing: -0.8,
  },
  sectionAction: {
    fontSize: 10,
    fontWeight: "800",
    color: moss,
    textDecorationLine: "underline",
  },
  editorialHero: {
    marginTop: 18,
    backgroundColor: moss,
    borderRadius: 2,
    padding: 22,
    minHeight: 204,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroCopy: { flex: 1 },
  overlineLight: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#BFD0C5",
  },
  heroTitle: {
    fontSize: 35,
    lineHeight: 37,
    color: "#fff",
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    letterSpacing: -1.4,
    marginTop: 12,
  },
  heroSub: { fontSize: 9, color: "#BFD0C5", marginTop: 17 },
  healthSeal: {
    width: 75,
    height: 75,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "#ADC2B5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  healthNumber: { fontSize: 27, color: "#fff", fontWeight: "700" },
  healthUnit: { fontSize: 8, color: "#BFD0C5", marginTop: -2 },
  healthWord: { fontSize: 6, color: "#BFD0C5", letterSpacing: 1, marginTop: 2 },
  temperatureBlock: {
    backgroundColor: "#FFFEFB",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderColor: line,
  },
  measureLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#7B827E",
  },
  tempRow: { flexDirection: "row", alignItems: "flex-start" },
  temperature: {
    fontSize: 55,
    fontWeight: "300",
    letterSpacing: -3,
    color: ink,
  },
  degree: { fontSize: 18, color: strawberry, marginTop: 9, marginLeft: 4 },
  range: { fontSize: 9, color: "#7B827E" },
  tempVisual: {
    width: "43%",
    height: 88,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  tempStem: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  metricStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderColor: line,
  },
  metricItem: {
    width: "50%",
    paddingVertical: 17,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: line,
  },
  metricTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  metricName: { fontSize: 10, color: "#707873", fontWeight: "700" },
  metricNumber: { fontSize: 21, color: ink, fontWeight: "700", marginTop: 8 },
  barTrack: {
    height: 3,
    backgroundColor: "#E2E3DE",
    marginTop: 9,
    overflow: "hidden",
  },
  barFill: { height: "100%" },
  recommendation: {
    flexDirection: "row",
    gap: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: line,
    paddingVertical: 18,
  },
  recIndex: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: moss,
    alignItems: "center",
    justifyContent: "center",
  },
  recIndexText: { fontSize: 10, fontWeight: "900", color: moss },
  recTitle: { fontSize: 15, fontWeight: "800", color: ink },
  recBody: { fontSize: 11, lineHeight: 18, color: "#67706A", marginTop: 6 },
  recTags: { flexDirection: "row", gap: 7, marginTop: 11 },
  recTag: {
    fontSize: 8,
    fontWeight: "800",
    color: moss,
    backgroundColor: "#E1E8E1",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: line,
  },
  signalMark: { width: 3, height: 42 },
  signalTitle: { fontSize: 13, fontWeight: "800", color: ink },
  signalText: { fontSize: 10, lineHeight: 15, color: "#717873", marginTop: 4 },
  signalTime: { fontSize: 8, color: "#8B918D" },
  serreFooter: {
    textAlign: "center",
    fontSize: 8,
    letterSpacing: 1.3,
    color: "#909590",
    marginTop: 25,
  },
  empty: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderColor: line,
  },
  emptyText: { fontSize: 11, color: "#69716C" },
  periodRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  period: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D2D1CA",
  },
  periodActive: { backgroundColor: moss, borderColor: moss },
  periodText: { fontSize: 9, fontWeight: "800", color: "#777D79" },
  periodTextActive: { color: "#fff" },
  bigChart: {
    backgroundColor: "#fff",
    padding: 18,
    borderWidth: 1,
    borderColor: line,
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between" },
  chartLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#7C837E",
  },
  chartMain: { fontSize: 33, color: ink, fontWeight: "500", marginTop: 4 },
  chartDelta: {
    fontSize: 9,
    fontWeight: "800",
    color: moss,
    backgroundColor: "#E5ECE7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    height: 25,
  },
  chartArea: {
    height: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    marginTop: 16,
    borderBottomWidth: 1,
    borderColor: "#DADCD7",
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  chartStroke: { width: 2, backgroundColor: "#AAC0B2" },
  chartPoint: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: moss,
    zIndex: 2,
  },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  statsBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 19,
    borderBottomWidth: 1,
    borderColor: line,
  },
  statValue: { fontSize: 17, fontWeight: "700", color: ink },
  statLabel: { fontSize: 7, letterSpacing: 1, color: "#7D837F", marginTop: 4 },
  balance: { borderTopWidth: 1, borderColor: line },
  balanceRow: { paddingVertical: 16, borderBottomWidth: 1, borderColor: line },
  balanceLabels: { flexDirection: "row", justifyContent: "space-between" },
  balanceName: { fontSize: 12, fontWeight: "800", color: ink },
  balanceHint: { fontSize: 8, color: "#858A87" },
  balanceValue: { fontSize: 18, fontWeight: "700", color: moss, marginTop: 8 },
  modeBlock: {
    padding: 20,
    borderWidth: 1,
    borderColor: line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modeBlockOn: { backgroundColor: moss, borderColor: moss },
  modeOver: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#808681",
  },
  modeTitle: {
    fontSize: 29,
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    color: ink,
    marginTop: 5,
  },
  modeDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: "#727A75",
    maxWidth: 245,
    marginTop: 5,
  },
  actionNote: {
    fontSize: 9,
    lineHeight: 14,
    color: "#7C837F",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: line,
  },
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: line,
  },
  equipmentIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFE6DF",
  },
  equipmentName: { fontSize: 13, fontWeight: "800", color: ink },
  equipmentSub: { fontSize: 9, color: "#7C827E", marginTop: 3 },
  statePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#E0E1DD",
  },
  statePillOn: { backgroundColor: moss },
  stateText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#747B76",
  },
  darkButton: {
    height: 52,
    backgroundColor: ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 18,
  },
  darkButtonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  thresholdGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: line,
  },
  threshold: {
    width: "50%",
    padding: 14,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: line,
  },
  thresholdName: { fontSize: 9, color: "#777E79" },
  thresholdValue: {
    fontSize: 18,
    fontWeight: "700",
    color: ink,
    marginVertical: 8,
  },
  intro: { fontSize: 12, lineHeight: 19, color: "#69716C", marginBottom: 22 },
  logRow: { flexDirection: "row", gap: 15 },
  logRail: { width: 16, alignItems: "center" },
  logDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  logLine: { width: 1, backgroundColor: "#C9CBC6", flex: 1, marginVertical: 5 },
  logContent: { flex: 1, paddingBottom: 27 },
  logDate: {
    fontSize: 8,
    letterSpacing: 1,
    color: "#858B87",
    fontWeight: "800",
  },
  logTitle: { fontSize: 15, fontWeight: "800", color: ink, marginTop: 5 },
  logBody: { fontSize: 10, lineHeight: 16, color: "#6E7671", marginTop: 6 },
  resolve: { fontSize: 9, fontWeight: "800", color: strawberry, marginTop: 9 },
  identity: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: line,
  },
  initials: {
    width: 58,
    height: 58,
    borderRadius: 29,
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 17,
    backgroundColor: moss,
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  identityName: { fontSize: 18, fontWeight: "800", color: ink },
  identityEmail: { fontSize: 10, color: "#777F7A", marginTop: 3 },
  identityRole: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: strawberry,
    marginTop: 7,
  },
  accountGreenhouse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderColor: line,
  },
  miniPhoto: {
    width: 45,
    height: 45,
    backgroundColor: "#587663",
    alignItems: "center",
    justifyContent: "center",
  },
  accountGhName: { fontSize: 13, fontWeight: "800", color: ink },
  accountGhMeta: { fontSize: 9, color: "#7B817D", marginTop: 4 },
  deviceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  deviceLinkText: { fontSize: 9, fontWeight: "800", color: moss },
  themeChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: line,
  },
  themeOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(108,145,124,.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderColor: line,
  },
  menuTitle: { fontSize: 12, fontWeight: "800", color: ink },
  menuSub: { fontSize: 9, color: "#7B817D", marginTop: 3 },
  logout: {
    height: 49,
    borderWidth: 1,
    borderColor: "#E0BFC1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
  },
  logoutText: { fontSize: 11, fontWeight: "800", color: strawberry },
  offlineBanner: {
    height: 31,
    backgroundColor: "#7B473B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  offlineText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  bottomNav: {
    height: 67,
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.9)",
    flexDirection: "row",
    paddingTop: 7,
    shadowColor: "#17231E",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
  },
  bottomNavDark: { borderTopColor: "rgba(255,255,255,.12)" },
  navItem: { flex: 1, alignItems: "center", position: "relative", zIndex: 1 },
  navGlassHalo: {
    position: "absolute",
    top: -3,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.8)",
  },
  navGlassHaloDark: {
    backgroundColor: "rgba(82,121,101,.26)",
    borderColor: "rgba(190,220,202,.18)",
  },
  navText: { fontSize: 8, color: "#8B918D", fontWeight: "700", marginTop: 4 },
  navTextActive: { color: moss },
  navIndicator: {
    position: "absolute",
    bottom: 2,
    width: 16,
    height: 2,
    backgroundColor: strawberry,
  },
  modalShade: { flex: 1, backgroundColor: "rgba(12,19,15,.55)" },
  sheet: {
    backgroundColor: "rgba(248,246,240,.96)",
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.72)",
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CACAC4",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetEyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#7A817C",
  },
  sheetTitle: {
    fontSize: 27,
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    color: ink,
    marginTop: 5,
    marginBottom: 17,
  },
  sheetGreenhouse: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderColor: line,
  },
  sheetGreenhouseActive: { backgroundColor: "rgba(227,234,228,.78)" },
  sheetIcon: {
    width: 38,
    height: 38,
    backgroundColor: "#AAB9AD",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetGhName: { fontSize: 13, fontWeight: "800", color: ink },
  sheetGhMeta: { fontSize: 9, color: "#737B76", marginTop: 3 },
  addGreenhouse: {
    height: 48,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: moss,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },
  addGreenhouseText: { fontSize: 11, fontWeight: "800", color: moss },
  formModal: { flex: 1, backgroundColor: paper },
  formHeader: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: line,
  },
  formTitle: { fontSize: 16, fontWeight: "800", color: ink },
  formBody: { padding: 20 },
  formLead: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    color: ink,
    marginBottom: 22,
  },
  photoPicker: {
    height: 125,
    borderWidth: 1,
    borderColor: moss,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 5,
  },
  photoPickerText: { fontSize: 11, fontWeight: "700", color: moss },
  noGreenhouse: {
    flex: 1,
    backgroundColor: paper,
    padding: 25,
    justifyContent: "center",
    gap: 16,
  },
  noGhTitle: {
    fontSize: 30,
    fontFamily: Platform.OS === "ios" ? "Georgia" : undefined,
    color: ink,
  },
  noGhText: { fontSize: 12, lineHeight: 19, color: "#707873" },
});
