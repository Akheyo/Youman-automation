# Produktionsplan: „Münster Edition" — Simpsons-Stil Unfallversicherungs-Video

**Für die ausführende Claude-Session:** Dieser Plan ist vollständig vorbereitet. Führe ihn Schritt für Schritt mit den Higgsfield-MCP-Tools aus. Alle Prompts sind final — nicht umformulieren, sie enthalten gelernte Korrekturen aus der ersten Produktionsrunde.

## Ziel

Ein durchgehendes ~55-Sekunden-Video (16:9, 1080p) im Stil des Simpsons-Vorspanns („Bocholt Edition"-Vorbild), aber für Münster, mit **einer festen Cartoon-Familie** und **realistischen Verkehrsunfällen** (ernst, kein Slapstick) an Münster-Wahrzeichen. Endprodukt: Werbespot für Unfallversicherung.

**Vom Nutzer festgelegt:** Klassischer Vorspann-Aufbau (Tafel-Gag → Figuren unterwegs → Couch-Gag) · eine feste 5-köpfige Familie · Wahrzeichen: Promenade/Leezen-Massen, Wochenmarkt am Dom, Schloss, Aasee · Budget ~120 Credits, Pro-Modus.

## Gelernte Regeln (unbedingt einhalten!)

1. **NIE „hazard lights" in Video-Prompts** — Kling generiert daraus Blaulicht-Balken auf dem Autodach (Morphing-Fehler der Runde 1).
2. **Positions-Kontinuität explizit vorgeben** („she falls on the SAME side of the car where she was riding") — sonst teleportieren Figuren/Objekte.
3. **St.-Paulus-Dom korrekt beschreiben:** „massive ROMANESQUE cathedral, beige sandstone, two heavy BLOCKY square towers with green copper roofs, round arches — NOT gothic, NOT red brick, NO filigree spires". Runde 1 erzeugte fälschlich eine rote gotische Kathedrale.
4. In jedem Video-Prompt: „NO slow motion, no floating, stable proportions, no morphing, static background, natural weight and gravity, fast snappy fall/impact".
5. Unfall-Choreografie als **nummerierte Kette mit Sekundenangaben** (bewährt in Runde 1).
6. Bilder: `nano_banana_pro`, 16:9 (2 Credits). Videos: `kling3_0`, mode `pro`, 8 s, `sound: off`, 16:9 (14 Credits). Vor jedem Start `get_cost: true` prüfen.
7. Der Prompt-Preset-Hinweis „IN THE DARK" erscheint manchmal — immer mit `declined_preset_id` wörtlich generieren, NIE den Preset nehmen.
8. Jedes Bild dem Nutzer per `job_display` zeigen BEVOR das Video generiert wird (Bilder blind zu animieren hat in Runde 1 den falschen Dom verbaut).

## Schritt 1 — Familien-Referenzblatt (1 Bild, 2 Credits)

Dieses Bild bei ALLEN Szenen-Bildern (Schritt 2) als Input-/Referenzbild mitgeben, damit die Familie überall identisch aussieht.

```
Character reference sheet, flat 2D cel animation cartoon style like a classic American animated sitcom, plain white background, all five characters standing side by side in a neutral pose, full body, front view. THE FAMILY: (1) DAD: chubby bald yellow-skinned man, ~40, two remaining hairs, white short-sleeved shirt, blue trousers, black shoes. (2) MOM: yellow-skinned woman with a VERY tall blue beehive hairdo, green sleeveless dress, red pearl necklace, red flat shoes. (3) SON: ~10-year-old yellow-skinned boy, spiky sawtooth haircut, red t-shirt, blue shorts, blue-white sneakers, holds a skateboard. (4) DAUGHTER: ~8-year-old yellow-skinned girl, starfish-shaped spiky hair, short red-orange dress with white collar, white sneakers. (5) BABY: yellow-skinned baby girl in light-blue onesie with a blue bow in her single-spike hair, pacifier. Bright saturated colors, black outlines, no photorealism.
```

## Schritt 2 — Sieben Szenen-Startbilder (je 2 Credits, Referenzblatt als Input mitgeben)

**Bild 1 — Intro-Titel:**
```
Flat 2D cel animation cartoon style like a classic American animated sitcom intro. Bright blue sky filled with puffy white cumulus clouds. Giant playful yellow wobbly cartoon letters reading "MÜNSTER EDITION" floating between the clouds, black outlines. Cheerful, vivid saturated colors, no photorealism.
```

**Bild 2 — Tafel-Gag (Sohn):**
```
Flat 2D cel animation cartoon style. Classroom interior: green chalkboard filling most of the frame, the SON from the reference sheet (spiky sawtooth hair, red t-shirt, blue shorts) stands at the board writing with white chalk. The same German sentence is repeated in neat handwritten chalk lines filling the board: "Ich fahre nie wieder ohne Licht über die Promenade." His skateboard leans against the wall next to the open classroom door. Warm classroom colors, black outlines, no photorealism.
```

**Bild 3 — Sohn auf der Promenade (Leezen-Massen):**
```
Flat 2D cel animation cartoon style. The Promenade in Münster, Germany: a wide car-free bicycle boulevard lined with big green linden trees, CROWDED with many cartoon cyclists of all kinds riding in both directions (Münster is Germany's bicycle capital). The SON from the reference sheet rides his skateboard fast along the edge of the bike path, about to weave into the stream of bicycles. A path crossing ahead. Bright saturated colors, black outlines, no photorealism.
```

**Bild 4 — Vater am Wochenmarkt/Dom (Ampel):**
```
Flat 2D cel animation cartoon style. Street beside the Domplatz in Münster, Germany during the weekly market: colorful market stalls with striped awnings, in the background the massive ROMANESQUE St.-Paulus-Dom cathedral — beige sandstone, two heavy BLOCKY square towers with green copper roofs, round arches, NOT gothic, NOT red brick, NO filigree spires. A red traffic light. A green cartoon car waits at the light. Behind it, a silver cartoon car driven by the DAD from the reference sheet (chubby, bald, white shirt), who is looking down at his smartphone instead of the road, close to the green car's rear bumper. Bright saturated colors, black outlines, no photorealism.
```

**Bild 5 — Mutter mit Baby am Schloss:**
```
Flat 2D cel animation cartoon style. The baroque Prince-Bishop's Palace (Schloss) of Münster, Germany: wide symmetrical baroque facade in red brick with beige sandstone elements, central portal with columns, forecourt with lawn. On the street in front, the MOM from the reference sheet (tall blue beehive hair, green dress) rides a city bicycle with the BABY in a child seat behind her, riding straight in the bike lane. Beside her on the left, a blue cartoon car drives parallel, slightly ahead, beginning to indicate right toward a side entrance. Bright saturated colors, black outlines, no photorealism.
```

**Bild 6 — Tochter am Aasee:**
```
Flat 2D cel animation cartoon style. Lakeside path at the Aasee in Münster, Germany: blue lake with two white sailboats on the left, green lawn on the right, a shared pedestrian/bike path along the shore, ducks near the water, Münster church tower silhouettes on the horizon. The DAUGHTER from the reference sheet (starfish hair, red-orange dress) jogs on the footpath wearing small headphones, looking at a smartwatch on her wrist, one step away from drifting onto the bike path. Behind her on the bike path a bearded cartoon man on a cargo bike with a loaded transport box approaches fast, eyes wide, gripping the brakes. Bright saturated colors, black outlines, no photorealism.
```

**Bild 7 — Couch-Gag-Finale:**
```
Flat 2D cel animation cartoon style, warm evening light. The Aasee lakeside lawn in Münster: a wooden park bench facing an old purple CRT television standing outdoors on the grass, its cable trailing away. The whole FAMILY from the reference sheet sits squeezed together on the bench — dad, mom with baby on her lap, son with skateboard, daughter — all wearing small comedic plasters, arm slings and bandages but smiling with relief. Ducks waddle past, lake and church tower silhouettes behind, sailboats. Bright saturated colors, black outlines, no photorealism.
```

## Schritt 3 — Sieben Pro-Clips (kling3_0, mode pro, 8 s, sound off, je 14 Credits)

Jeweils das passende Bild aus Schritt 2 als `start_image` (Job-ID) übergeben.

**Clip 1 — Intro (Bild 1):**
```
Classic animated sitcom opening. Seconds 0-3: the camera glides slowly forward between the puffy clouds toward the floating yellow title letters, the letters bob gently. Seconds 3-8: the camera dives down through the cloud layer and reveals a colorful 2D cartoon aerial panorama of Münster, Germany — the two heavy blocky Romanesque towers of St. Paulus cathedral with green roofs, the single tall thin spire of Lamberti church, red rooftops, the blue Aasee lake glittering at the edge — and swoops gently toward the city center. Smooth cinematic camera move, consistent flat 2D cel animation style, bright saturated colors, stable geometry, no morphing.
```

**Clip 2 — Tafel-Gag (Bild 2):**
```
Classic animated sitcom chalkboard gag. Seconds 0-5: the boy writes the same German line on the chalkboard one more time with squeaky chalk strokes, his hand moving naturally, the existing chalk lines stay EXACTLY as they are (text must remain stable and legible, no letters changing). Second 5: a school bell rings silently (he reacts), he drops the chalk. Seconds 5-8: he grabs his skateboard from the wall, runs out through the open door and jumps onto the skateboard mid-stride. Natural weight in every movement, fast snappy timing, NO slow motion, stable proportions, no morphing, static background.
```

**Clip 3 — Sohn/Promenade-Kollision (Bild 3):**
```
Professional 2D cel animation, frame-exact choreography of a skateboard-bicycle collision. Seconds 0-3: the boy weaves on his skateboard through the stream of cyclists on the crowded bike boulevard, cyclists ring bells and dodge. Seconds 3-4, contact: at the path crossing his skateboard's FRONT WHEELS clip the FRONT WHEEL of a crossing cyclist. Exact chain within 1 second: (1) the skateboard stops dead and shoots out from under his feet, (2) he stumbles forward two steps with arms windmilling, (3) he falls onto the grass strip beside the path — palms first, then knees, low forward tumble, NO flight, NO somersault, (4) the cyclist wobbles, puts a foot down and stays upright, the skateboard rolls away slowly. Both stay on the SAME sides where they started, nothing teleports. Seconds 4-8: the cyclist helps the boy up, the boy rubs his knee, retrieves his skateboard sheepishly. Serious realistic tone, natural weight and gravity, fast snappy fall, NO slow motion, stable proportions, no morphing, static background.
```

**Clip 4 — Vater/Auffahrunfall am Dom (Bild 4):**
```
Professional 2D cel animation, frame-exact choreography of a rear-end collision. Seconds 0-3: the green car stands still at the red light, the silver car rolls closer at 15 km/h, its driver staring at his phone the whole time. Seconds 3-4, contact: the CENTER of the silver car's front bumper hits the CENTER of the green car's rear bumper flat on. Exact chain within 1 second: (1) the silver car's nose dives DOWN as the suspension compresses, its rear lifts slightly, (2) the green car is pushed half a meter forward and rocks once, (3) both cars bounce twice on their suspensions and stand still, (4) the plastic bumper cover drops straight down and clatters on the asphalt, the driver's head snaps forward then back into the headrest, the phone flies onto the passenger seat. The cars keep their shape and colors, NO roof lights appear, NO broken glass. Seconds 4-8: both drivers get out and inspect the dented bumpers; one crosses his arms shaking his head, the phone driver raises both hands apologetically. Market stalls and the Romanesque cathedral stay unchanged in the background. Serious realistic everyday tone, natural weight, fast snappy impact, NO slow motion, stable proportions, no morphing, static background.
```

**Clip 5 — Mutter/Abbiege-Unfall am Schloss (Bild 5):**
```
Professional 2D cel animation, frame-exact choreography of a right-turn accident. Seconds 0-3: the mother cycles steadily in the bike lane with the baby in the child seat, the blue car drives parallel on her LEFT, slightly ahead, indicating right. Seconds 3-4: the car turns right across the bike lane WITHOUT checking. Contact: the car's FRONT RIGHT CORNER touches the bicycle's FRONT WHEEL. Exact chain within 1 second: (1) the front wheel is deflected sideways, the handlebar jerks, (2) she brakes hard and the bike tips slowly sideways to the RIGHT — away from the car — as she loses balance at low speed, (3) she catches the fall with her right foot and right hand, going down onto one knee, holding the handlebar with her left hand so the bike only leans, (4) the baby stays safe and upright in the child seat the whole time. She and the bike stay on the SAME side of the car throughout, nothing teleports, the car keeps its shape, NO roof lights. Seconds 4-8: the car stops, the driver rushes out and steadies the bike; the mother stands up, checks the baby first, then shows the driver her scraped hand. Serious realistic tone, natural weight and gravity, fast snappy movement, NO slow motion, stable proportions, no morphing, static baroque palace background.
```

**Clip 6 — Tochter/Lastenrad am Aasee (Bild 6):**
```
Professional 2D cel animation, frame-exact choreography of an evasive cargo-bike fall. Seconds 0-3: the girl jogs looking at her smartwatch and drifts step by step onto the bike path, the cargo bike approaches fast from behind her. Seconds 3-4, reaction chain within 1.5 seconds: (1) the rider brakes hard, the rear wheel locks and the bike shudders, (2) he swerves RIGHT around the girl, (3) the weight of the loaded front box makes the cargo bike tip over its right side, it lands heavily on the lawn and slides half a meter — it falls fast and heavy, it does NOT float, (4) the rider half-steps off while falling and rolls over his right shoulder onto the grass, ending sitting, (5) the box lid flips open, groceries tumble out and roll across the path, ducks scatter flapping. The girl is NEVER touched. Everything stays on the same sides, nothing teleports. Seconds 4-8: the girl rips off her headphones, hurries over, pulls the rider up; both collect the groceries, the rider rubs his shoulder. Serious realistic tone, natural weight and gravity, fast snappy fall, NO slow motion, stable proportions, no morphing, static lake background.
```

**Clip 7 — Couch-Gag-Finale (Bild 7):**
```
Classic animated sitcom couch gag, outdoors. Seconds 0-3: the camera slowly pushes in on the bandaged family squeezed on the park bench; they wiggle and settle like at the start of a sitcom episode, the baby waves at the camera. Seconds 3-4: the old purple TV in front of them flickers on with a warm glow. Seconds 4-8: the family watches the TV together, dad puts his arm around mom, the son balances his skateboard on his knees, ducks waddle past in the warm evening light. Gentle natural movement, cozy tone, stable proportions, no morphing, static background.
```

## Schritt 4 — Endmontage

1. Reihenfolge: Clip 1 → 2 → 3 → 4 → 5 → 6 → 7 (≈ 56 s).
2. **Achtung:** Die Higgsfield-`explainer_video`-Montage war am 09.07.2026 durch zwei hängende Server-Jobs dauerhaft blockiert (429). Erst mit EINEM Aufruf testen; wenn 429 kommt, NICHT wiederholen, sondern:
3. **Lokaler Schnitt (bewährt):** Nutzer lädt die 7 Clips in den Chat → ffmpeg (imageio-ffmpeg installieren) → auf 1920×1080/24fps normalisieren → concat → unter 30 MiB enkodieren (crf 23) → per SendUserFile zurückschicken. Genau so wurde Version 1 erfolgreich geliefert.
4. Musik + deutsches Voiceover macht der Nutzer in HeyGen AI Studio. Voiceover-Text: „Münster ist wunderschön – aber ein Unfall passiert schneller, als man denkt. Sichere dich und deine Familie ab. Jetzt zur Unfallversicherung beraten lassen!" Text-Einblendung: „Unfälle passieren schneller, als man denkt."

## Kostenübersicht

| Posten | Credits |
|---|---|
| 1 Referenzblatt + 7 Szenen-Bilder (nano_banana_pro) | 16 |
| 7 Clips kling3_0 pro 8 s ohne Ton | 98 |
| **Summe** | **114** |

Reserve für 1–2 Nachbesserungen einplanen. Fehlgeschlagene/NSFW-geflaggte Jobs kosten nichts.

## Vorhandene Assets aus Runde 1 (Job-IDs im Higgsfield-Konto)

Bilder: Titel `4cc80e69`, Prinzipalmarkt-Junge `bff9bf8a`, Dom-Radfahrer `0ca165ab`, Aasee-Tretboot `e0bdd0b9`, Familie-Bank `eb68d95b`, Abbiege-Szene `3f13943d`, Ampel-Szene `39bf725f`, Promenade `dac2880d`, Aasee-Lastenrad `6dbf97e9`, Rathaus-Auto `27e8de28`.
Beste Clips: Auffahrunfall-Choreo `44e69626` (gut, aber falscher Dom), Abbiege-Choreo `dc09ac79` (Teleport-/Blaulicht-Fehler), Promenade `acb7e62b`, Aasee `ef81d44a`, Intro `6c4970e6`, Finale `b2269343`.
Fertiger Schnitt v1 liegt beim Nutzer als `Muenster_Edition_1080p.mp4`.

## Video-Dateien im Repo (Runde 1, gesichert)

Unter `assets/muenster-edition/` liegen die 6 Original-Clips der ersten Runde (nummeriert in Schnittreihenfolge) sowie der fertige Schnitt `Muenster_Edition_v1_komplett.mp4`. Die neue Session kann sie direkt verwenden (z. B. als Vergleich, oder um einzelne gute Szenen zu übernehmen statt alles neu zu generieren).
