# KivuSense — manuel complet de fonctionnement

**Intelligence climatique pour cultures sous serre.**

KivuSense est le projet IoT de fin d’études consacré à la surveillance et à la régulation des paramètres climatiques d’une serre de fraises à Goma.

Ce manuel est écrit pour être suivi depuis zéro. Si tu ne connais pas encore le fonctionnement du projet, suis les étapes dans l’ordre.

## 1. Comment fonctionne KivuSense ?

KivuSense possède quatre éléments :

1. **La serre et ses capteurs** mesurent la température, l’humidité de l’air, l’humidité du sol, la lumière, le CO₂, la pression et le niveau d’eau.
2. **L’ESP32** lit les capteurs et envoie une mesure toutes les 30 secondes à l’API.
3. **L’API FastAPI** vérifie la clé de l’ESP32, enregistre les mesures dans la base de données et crée les alertes.
4. **L’application KivuSense** affiche le dashboard, l’historique, les alertes et l’état des équipements sur mobile et sur web.

```text
Capteurs → ESP32 → API FastAPI → Base de données → Application mobile/web
                                      ↓
                         Alertes, recommandations, historique
```

L’application n’accède jamais directement à la base. Elle passe toujours par l’API. Chaque serre appartient à un compte utilisateur.

## 2. Ce qu’il faut installer sur le PC

Installe ces logiciels une seule fois :

- **Node.js 20.19 ou plus récent** : https://nodejs.org/
- **Python 3.11 ou plus récent** : https://www.python.org/downloads/
- **Arduino IDE 2** pour programmer l’ESP32 : https://www.arduino.cc/en/software
- **Expo Go** sur le téléphone Android/iPhone : Play Store ou App Store
- Un câble USB de données pour l’ESP32

Pendant l’installation de Node.js, garde les options par défaut. Après installation, redémarre Windows si nécessaire.

## 3. Premier démarrage de l’application

Ouvre le dossier du projet :

```text
C:\Users\USER PC\Desktop\GOLDEN PROJECT\FraiseSmart
```

Double-clique ensuite sur :

```text
LANCER_KIVUSENSE.bat
```

Le lanceur fait automatiquement les opérations suivantes :

1. détecter l’adresse IP du PC sur le réseau local ;
2. créer ou mettre à jour `.env` pour le téléphone ;
3. télécharger les paquets npm manquants ;
4. créer l’environnement Python si nécessaire ;
5. télécharger FastAPI, SQLAlchemy, JWT et le pilote PostgreSQL manquants ;
6. démarrer l’API sur le port `8000` ;
8. démarrer Expo en mode réseau local avec `npx expo start --lan --clear`.

Le mode tunnel (`--tunnel`) dépend de ngrok et peut échouer si cette connexion est bloquée ou trop lente. Le mode local est plus fiable pour le réseau Wi‑Fi de la serre et fonctionne bien avec Expo Go.

Une connexion Internet est nécessaire au premier lancement pour télécharger les dépendances. Les lancements suivants vérifient simplement que tout est disponible.

Quand le terminal Expo apparaît :

- scanne le QR avec Expo Go pour le téléphone ;
- appuie sur `W` pour ouvrir la version web ;
- appuie sur `R` pour recharger l’application ;
- appuie sur `Ctrl+C` pour arrêter Expo.

Ne lance pas `npm start` à la place du lanceur si tu veux démarrer toute l’architecture. Le lanceur démarre aussi le backend.

## 4. Première utilisation de l’application

### Créer un compte

Dans l’application :

1. appuie sur **Créer un compte** ;
2. saisis ton nom complet ;
3. saisis une vraie adresse e-mail ;
4. ajoute éventuellement ton téléphone ;
5. choisis un mot de passe d’au moins 8 caractères ;
6. répète exactement le même mot de passe ;
7. appuie sur **Créer mon espace**.

Une adresse déjà utilisée ne peut pas être réinscrite. Dans ce cas, utilise la connexion ou une autre adresse.

### Créer une serre

Après la connexion :

1. ouvre l’onglet **Compte** ;
2. appuie sur **Ajouter** ;
3. donne un nom, par exemple `Serre Nyiragongo` ;
4. indique `Goma · Mugunga` comme localisation ;
5. indique la variété, par exemple `Albion` ;
6. ajoute une photo si tu en as une ;
7. appuie sur **Créer la serre**.

Une serre est automatiquement associée à ton compte. Un autre utilisateur ne peut pas voir ses mesures.

## 5. Connecter l’ESP32 à la serre

Cette étape se fait après avoir créé une vraie serre.

### Obtenir la clé de l’ESP32

Dans l’application :

1. ouvre **Compte** ;
2. repère ta serre ;
3. appuie sur **Connecter l’ESP32** ;
4. copie la clé affichée.

Cette clé identifie ton ESP32. Ne la publie pas sur GitHub et ne l’envoie pas à une autre personne.

### Vérifier l’adresse de l’API

Dans le terminal du lanceur, tu verras une ligne similaire à :

```text
PC : 192.168.1.20
API : EN LIGNE
```

L’adresse à utiliser dans l’ESP32 sera donc :

```text
http://192.168.1.20:8000/iot/measurements
```

Ton PC et l’ESP32 doivent être connectés au même réseau Wi-Fi. N’utilise pas `127.0.0.1` dans l’ESP32 : cette adresse signifie « l’ESP32 lui-même ».

## 6. Installer les bibliothèques Arduino

Ouvre Arduino IDE, puis :

1. va dans **Fichier → Préférences** ;
2. dans **URL de gestionnaire de cartes supplémentaires**, ajoute :

```text
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

3. va dans **Outils → Type de carte → Gestionnaire de cartes** ;
4. cherche `esp32` ;
5. installe **esp32 by Espressif Systems** ;
6. sélectionne **Outils → Type de carte → ESP32 Arduino → ESP32 Dev Module**.

Installe ensuite dans **Croquis → Inclure une bibliothèque → Gérer les bibliothèques** :

- `DHT sensor library` par Adafruit ;
- `Adafruit BMP280 Library` ;
- `BH1750` ;
- `ArduinoJson`.

Arduino installera également `Adafruit Unified Sensor` si la bibliothèque DHT le demande.

## 7. Préparer le programme ESP32

Ouvre le fichier :

```text
esp32\KivuSense_ESP32.ino
```

Modifie uniquement ces quatre lignes :

```cpp
const char* WIFI_SSID = "NOM_DE_TON_WIFI";
const char* WIFI_PASSWORD = "MOT_DE_PASSE_WIFI";
const char* API_URL = "http://192.168.1.20:8000/iot/measurements";
const char* DEVICE_KEY = "CLE_RECUPEREE_DANS_KIVUSENSE";
```

Exemple :

```cpp
const char* WIFI_SSID = "Maison_Goma";
const char* WIFI_PASSWORD = "MonWifiFort2026";
const char* API_URL = "http://192.168.1.20:8000/iot/measurements";
const char* DEVICE_KEY = "a-remplacer-par-ta-vraie-cle";
```

Ne laisse pas les valeurs `VOTRE_WIFI` ou `CLE_COPIEE_DEPUIS_KIVUSENSE`.

Dans Arduino IDE :

1. branche l’ESP32 en USB ;
2. choisis le port dans **Outils → Port** ;
3. sélectionne **ESP32 Dev Module** ;
4. clique sur **Téléverser** ;
5. si Arduino affiche `Connecting...`, appuie une fois sur le bouton **BOOT** de l’ESP32 ;
6. ouvre **Outils → Moniteur série** à `115200 bauds`.

Quand tout fonctionne, le moniteur affiche un code HTTP `201` toutes les 30 secondes. Le code `201` signifie : mesure enregistrée.

## 8. Câblage de référence

Utilise une alimentation stable et relie toutes les masses `GND` ensemble. Les entrées analogiques ESP32 ne doivent jamais recevoir plus de `3,3 V`.

| Élément | Broche ESP32 | Rôle |
|---|---:|---|
| DHT22 DATA | GPIO 4 | température et humidité de l’air |
| Sonde humidité du sol | GPIO 34 | entrée analogique |
| MQ-135 CO₂ | GPIO 35 | entrée analogique, estimation à calibrer |
| Niveau d’eau | GPIO 32 | entrée analogique |
| BMP280 SDA | GPIO 21 | bus I²C |
| BMP280 SCL | GPIO 22 | bus I²C |
| BH1750 SDA | GPIO 21 | bus I²C partagé |
| BH1750 SCL | GPIO 22 | bus I²C partagé |
| Relais pompe | GPIO 25 | actionneur irrigation |
| Relais ventilateur | GPIO 26 | actionneur ventilation |
| Relais brumisateur | GPIO 27 | actionneur brumisation |
| Relais lampe LED | GPIO 14 | éclairage horticole |
| Buzzer | GPIO 13 | alarme locale |

Le programme suppose que les relais sont **actifs à LOW**. Ne branche jamais directement une pompe ou une charge secteur sur une broche ESP32. Utilise un module relais adapté, une alimentation séparée et les protections électriques nécessaires.

## 9. Calibration des capteurs analogiques

Les valeurs analogiques changent selon le matériel. Le programme contient des valeurs de départ, mais elles doivent être calibrées.

### Humidité du sol

1. laisse la sonde dans un sol sec et note la valeur brute ;
2. mets la sonde dans un sol humide et note la valeur brute ;
3. remplace `3200` et `1200` dans `percentFromAnalog` par tes valeurs ;
4. vérifie que l’application affiche environ `0 %` dans le sec et `100 %` dans le très humide.

### Niveau d’eau

Fais la même opération avec le réservoir vide et plein, puis remplace `300` et `3000` dans l’appel `percentFromAnalog(WATER_PIN, ...)`.

### MQ-135

La valeur CO₂ du programme est une estimation. Pour un résultat scientifique précis, il faut un capteur CO₂ étalonné, une phase de préchauffage et une calibration avec une référence connue. Dans le mémoire, présente le MQ-135 comme une mesure indicative si tu ne disposes pas d’un étalonnage professionnel.

## 10. Vérifier que tout est connecté

Le test complet suit cet ordre :

1. démarre `LANCER_KIVUSENSE.bat` ;
2. vérifie `API : EN LIGNE` dans le terminal ;
3. ouvre `http://127.0.0.1:8000/docs` dans le navigateur ;
4. connecte-toi dans l’application ;
5. crée une serre ;
6. affiche la clé avec **Connecter l’ESP32** ;
7. configure le fichier Arduino ;
8. téléverse le programme ;
9. observe le moniteur série ;
10. ouvre le dashboard et attends une nouvelle mesure ;
11. vérifie la température, l’humidité du sol et la luminosité ;
12. provoque une condition d’alerte contrôlée, par exemple une sonde sèche ;
13. vérifie que l’alerte apparaît dans **Vue** et **Journal**.

## 11. Comprendre les écrans de l’application

- **Vue** : état général, score santé, température, humidité, lumière, CO₂, recommandations et alertes.
- **Analyse** : évolution des mesures sur 24 heures, 7 jours ou 30 jours.
- **Actions** : mode automatique ou manuel et état de la pompe, du ventilateur, du brumisateur, de la lampe et du buzzer.
- **Journal** : historique des alertes et actions importantes.
- **Compte** : profil, serres, connexion ESP32, mode sombre et rapport PDF.

En mode automatique, les commandes manuelles sont verrouillées pour éviter qu’une action humaine contredise la régulation. Les seuils par défaut sont : température maximale `28 °C`, humidité minimale du sol `50 %`, CO₂ maximal `1000 ppm` et eau minimale `25 %`.

## 12. Base de données

### Mode local actuel

Sans variable `DATABASE_URL`, KivuSense utilise :

```text
sqlite:///./database.db
```

Le fichier `database.db` contient les utilisateurs, serres, mesures, actionneurs, alertes et seuils. Il est pratique pour le développement et la soutenance sur un seul PC.

### Mode PostgreSQL hébergé

Pour conserver les données dans le cloud :

1. crée une base PostgreSQL gratuite sur Neon, Supabase ou Render ;
2. copie son URL de connexion ;
3. définis `DATABASE_URL` dans les variables d’environnement du backend ;
4. définis `EXPO_PUBLIC_API_URL` avec l’URL HTTPS de l’API ;
5. redémarre l’API ;
6. crée un compte de test et une nouvelle serre.

Ne mets jamais le mot de passe PostgreSQL dans GitHub, dans le firmware ou dans l’application mobile.

## 13. Dépannage rapide

### Le téléphone affiche une erreur réseau

- le téléphone et le PC doivent être sur le même Wi-Fi ;
- vérifie l’adresse `PC : ...` affichée par le lanceur ;
- le fichier `.env` doit contenir cette adresse sur la ligne `EXPO_PUBLIC_API_URL` ;
- relance `LANCER_KIVUSENSE.bat` après un changement de réseau ;
- autorise Python et Node.js dans le pare-feu Windows si Windows le demande.

### Le compte refuse l’inscription

- nom complet : au moins 2 caractères ;
- e-mail : format valide ;
- mot de passe : au moins 8 caractères ;
- confirmation identique ;
- une adresse déjà utilisée ne peut pas être réinscrite.

### L’ESP32 reste bloqué sur le Wi-Fi

- vérifie le nom exact du Wi-Fi et le mot de passe ;
- utilise un réseau 2,4 GHz si ton ESP32 ne voit pas le 5 GHz ;
- vérifie que le PC et l’ESP32 sont sur le même réseau ;
- ouvre le moniteur série à `115200`.

### Le moniteur affiche HTTP 401

La clé `DEVICE_KEY` est incorrecte. Retourne dans **Compte → Connecter l’ESP32** et recopie la clé de la bonne serre.

### Le moniteur affiche HTTP 404 ou 0

L’adresse `API_URL` est incorrecte ou l’API n’est pas démarrée. Elle doit finir exactement par :

```text
/iot/measurements
```

### La mesure ne s’affiche pas

Attends au moins 30 secondes, actualise la Vue et vérifie que le moniteur série affiche HTTP `201`.

## 14. Commandes utiles

Vérifier le projet mobile :

```powershell
npm run check
```

Construire le site web :

```powershell
npm run build:web
```

Compiler le backend :

```powershell
.\Fraisebackend\.venv\Scripts\python.exe -m py_compile Fraisebackend\main.py Fraisebackend\database.py
```

Documentation interactive de l’API :

```text
http://127.0.0.1:8000/docs
```

## 15. Checklist de soutenance

- [ ] Le lanceur démarre sans erreur.
- [ ] Le compte est créé et la connexion fonctionne.
- [ ] Une serre appartient bien au compte connecté.
- [ ] L’ESP32 reçoit le Wi-Fi.
- [ ] Les capteurs produisent des valeurs plausibles.
- [ ] Une mesure arrive dans l’application.
- [ ] Une alerte apparaît lorsque le seuil est dépassé.
- [ ] Le mode automatique est visible.
- [ ] Le journal conserve l’événement.
- [ ] Le rapport PDF peut être généré.
- [ ] Le mode sombre fonctionne.
- [ ] La version web fonctionne avec `W` dans Expo.

## 16. Ce qui reste à fournir par l’étudiant

Le code est prêt, mais ces éléments dépendent de ton matériel ou de tes comptes :

- les capteurs et actionneurs physiques ;
- les valeurs réelles de calibration ;
- le nom et le mot de passe du Wi-Fi ;
- la clé ESP32 de chaque serre ;
- l’URL PostgreSQL si tu veux le cloud ;
- l’URL publique de l’API après hébergement ;
- les captures d’écran et résultats expérimentaux à intégrer dans le mémoire.
