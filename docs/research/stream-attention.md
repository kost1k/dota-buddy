# Attention on a live stream: what holds it over three hours

Companion to `face-perception.md` and `shape-motion-perception.md`. Those ask
whether a 135 px creature **can** be read; this one asks whether anyone will
**look at it** on a real stream, with a real audience, for hours. Markers:
**[E]** measured in a primary I read; **[E?]** reported by a secondary
that read the primary; **[IND]** industry data with a named source but no
published method; **[LORE]** craft practice with no measurement behind it.
Unmarked numbers are derived here and labelled as such.

**Headline.** The one directly relevant eye-tracking study puts the streamer's
own webcam at **4.6% of viewer fixations** and animated peripheral banners at
**~1.5%**. Everything else here is web pages, TV news, advertising, or vendor
marketing. "Overlays increase retention" has **no peer-reviewed support and no
published platform data at all**.

## 1. Viewer attention on game streams

**Mancini, Cherubino, Cartocci, Martinez, Di Flumeri, Petruzzellis, Cimini,
Aricò, Trettel & Babiloni (2022)**, *Esports and Visual Attention*, **Brain
Sciences 12(10), 1345**, `doi:10.3390/brainsci12101345` **[E]** — the only
eye-tracking study I found measuring a **Twitch layout** rather than a game.
**n = 47** males, mean age 23 (SD 4.1), matched to Twitch's demographics
(16–34 = 72%, male = 78%). **Tobii Pro X2-30 at 30 Hz**, 22-inch screen; four
3-minute clips of a **FIFA20** Twitch stream, ad format (static/animated) ×
match event (Goal/No-Goal); measure, fixation-count share.

| AOI | share of visual attention |
| --- | ---: |
| Chat | **10.68%** |
| Facecam (the streamer's own face) | **4.60%** |
| All in-game advertising | 3.49% |
| — billboards / left banner / right banner | 1.59 / 1.30 / 0.61% |

Two results matter more than the table. **Animated beat static, barely**: left
banner **1.46% animated vs 1.12% static**, `Z = −2.658, p = .007, r = −0.28`.
A **0.34 pp** gain — real, tiny, and the *only* measured number anyone has on
whether animating a peripheral stream element buys attention. And **peripheral
attention went *up* during the exciting moment**: right banner **0.69% in goal
scenes vs 0.51% in no-goal scenes**, `Z = −2.658, p = .008, r = −0.27`. One of
three ad AOIs, small effect — but it runs against the intuition that a teamfight
blanks out the surround; viewers appear to unload gaze onto the periphery when
the action peaks. Note also that **chat beats the face by more than 2:1**: the
overlay's competitor is not the game, it is the chat.

**Derived: what share could a 135 px buddy get?** 135×135 = 18,225 px² =
**0.88% of a 1920×1080 frame**; a 480×270 facecam is **6.25%**. If fixation
share scaled with area at the facecam's rate (4.60/6.25 = 0.74 fixation-% per
area-%), the buddy lands near **0.65% of fixations** — **roughly 60–110 s of
direct looking across a 3-hour stream**, in hundreds of sub-second glances.
*Arithmetic, not measurement* — area is not the only driver, and a face is not
a fair per-pixel baseline — but it sets the order of magnitude honestly.

**Where I found nothing.** No study compares **engaged vs background** stream
viewers' gaze. Nearest: Segijn et al., *Computers in Human Behavior* 38 (2014),
**n = 85** **[E?]** — second-screen viewing lowered factual recall and
comprehension of TV news, mediated by cognitive load; direction only.
Prevalence is only estimable: **99% of TV viewers multitask** (TiVo 2015
**[IND]**), **>25%** of Twitch viewers do (Twitch Q3 2022, second-hand
**[IND]**), and the **60–90% lurker** figure has no traceable source
**[LORE]**. Mobile is put at **~35–41% of Twitch views** **[IND, weak]**, and
since 135 px is **7.0% of frame width**, the buddy renders at **~27 px** on a
phone. Esports *player* gaze is well studied; none transfers to spectators.

## 2. What retains viewers

**Sjöblom & Hamari, *Computers in Human Behavior* 75 (2017), n = 1,097
survey** **[E?]**. Positively associated with **hours watched**: tension
release, social integrative, affective motivations. **Social integrative** is
the main predictor of subscribing; information seeking predicts hours and
breadth of streamers watched. Self-report, cross-sectional. **Parasocial
affinity predicts time spent** and donation likelihood (Kneisel & Sternadori,
*Convergence*, 2023) **[E?]**, also correlational.

**Moment-to-moment engagement is predictable from game events.** Melhart et
al., *PUBG Streaming on Twitch* (arXiv 2008.07207) **[E]**: several hundred
matches from five streamers, **>100,000 game events**, 40 telemetry features
predicting **chat frequency** — **up to 80% mean, 84% best accuracy**,
generalising across streamers. **In-game events drive the audience's
second-by-second reaction, and that mapping is stable enough to learn** —
nothing about overlays, but the signal the buddy is fed is the right one.

**What is not measured.** There is **no peer-reviewed evidence that a visual
overlay affects watch time or retention**, and no published Twitch, YouTube or
Kick analytics on it. Vendor claims are unusable: Muxy's "viewers on
interactive streams watch for longer" has **no number, no method, no source**
**[LORE]**; a content-farm page claims animated timers raised 2-minute
retention "from 43% to 89%" **[LORE, almost certainly fabricated]**. **The
overlay-retention link is a marketing claim.**

## 3. Mascots and characters in streaming

**The strongest number is from advertising.** System1's "fluent devices"
(recurring brand characters) against IPA Effectiveness Awards data **[IND]**:
campaigns using one are **37% more likely to grow market share**, **30% more
likely to grow profit**, **73% more likely to report a *large* profit gain**;
mascot-fronted Super Bowl ads scored **1.38 mean Spike Rating vs 1.24** for
celebrity ads; use among entries fell from **41% (1992) to 12%**. These are
odds ratios on business outcomes in 30-second ads, from a vendor selling
character testing — they argue a recurring character is a good *brand* asset,
not that one holds attention for hours.

**Avatarisation does not buy parasocial connection.** UCF thesis (2020),
**n = 413** undergraduates, between-subjects No Face / VTuber / Face, same
streamer playing Minecraft **[E?]**: the VTuber condition produced
**significantly *less* social presence (social richness)** and **no significant
difference** in interpersonal attraction, credibility or parasocial
interaction. Not a parasocial upgrade over a webcam — in the only dimension
that moved, a downgrade.

**Yin, Shen & Xiao, IMX 2025, n = 21 interviews** **[E]**: **appearance is the
hook, personality is the retention** — one participant's summary was that you
are there for the character until you are there for the person. Viewers also
reported VTubers feel **more distant**, and a minority preferred that.

**AI VTubers: reactivity and unpredictability, not the avatar.** Two 2025
Neuro-sama studies. Survey work (arXiv 2509.10427) **[E?]**: **92% rated "fun
interaction between community and AI" important or very important**, the
second-most-cited draw being **"unpredictable, surprising atmosphere"**;
technical failures were reinterpreted as personality. Corpus study
(arXiv 2509.20817) **[E]**: **108k Reddit + 136k YouTube comments**, Jan 2023 –
May 2025, LLM annotation at 96.4% accuracy — avatar cuteness was a real but
minority theme (**15% Reddit / 7% YouTube**), attachment ran through **AI–human
interaction** (**18% / 23%**), **collaborative streams consistently beat solo
streams**, and the authors conclude **human-in-the-loop dynamics, not the AI
itself, drove appeal**. Context **[IND]**: subs ~2,825 → ~40,000 in twelve
days, Dec 2022.

**Character, reactivity, or parasocial channel?** The evidence points at
**reactivity inside a human relationship**; the character is the container.
Nothing supports a character holding attention on its own merits.

## 4. Motion and distraction on a busy screen

**Motion onset, not motion.** **Abrams & Christ (2003), *Psychological
Science* 14(5), 427–432** **[E?]**: **motion onset captures attention;
continuous motion does not.** Across three experiments there was **no advantage
for moving letters among static ones**, but a clear advantage for objects that
had **recently started** to move, even though the motion was uninformative.
Motion *offset* did not do it either. Replicated in **Attention, Perception &
Psychophysics 80 (2018)** **[E?]**. The consequence is blunt: **a perpetually
looping idle buys no attention at all.** What buys it is the transition from
still to moving, so a buddy that always wiggles has spent its only attentional
currency before anything happens. The arousal-scaled idle in
`shape-motion-perception.md` that **falls to zero at rest** is doing double
duty — honest signalling, and what makes every reaction an onset.

**Peripheral animation is less distracting than folklore claims.**
**McCrickard et al.** **[E]**, **n = 70** (within) and **n = 91** (between),
comparing fade (500 ms, 2000 ms cycle), ticker (1 px / 50 ms) and blast
(instant) against a no-animation control during browsing: **no effect of
animation on primary-task time** (`F(3,58) = 0.60, p = .62`; type
`F(2,46) = 0.62, p = .54`); awareness **faster for blast and fade than ticker**
(`F(2,52) = 17.24, p < .001`); **ticker had better recall** — 52.11% vs 43.66%
(fade) and 42.72% (blast), `F(2,96) = 3.87, p < .03` — but was slowest to
notice. Against this, **Zhang (2000), *JAIS* 1(1)** **[E?]**: animation as a
secondary stimulus degrades information seeking, and **distraction helped
simple tasks but impaired complex ones** — watching a stream is not complex.
**In-place change is noticed fast and costs little; travelling motion is
remembered better, noticed slower, and is the one that irritates.**

**Banner blindness is weaker than its reputation.** **Hervet et al. (2011),
*Applied Cognitive Psychology* 25, 708–716** **[E?]**: **82% of participants
fixated at least one of four banners** — "people do not look" is **not
supported**, the original evidence being indirect (poor recall). Blindness is
stronger for **right-hand placement** and under **demanding tasks** **[E?]**.
Applicability is limited (banners are known-irrelevant, fixed and structurally
segregated; a buddy changes in response to what the viewer is watching), but
the placement point stands, and the FIFA20 study agrees: its worst AOI was also
the right banner (0.61% vs 1.30% left).

**Habituation: a reaction is dead by its third use.** **Vance, Kirwan, Bjornn,
Jenkins & Anderson, CHI 2017** **[E]** — the best longitudinal data on
habituation to a repeating visual element. **n = 15**, **five consecutive daily
fMRI scans with simultaneous EyeLink 1000 Plus eye tracking**, 260 images/day,
**3 s per image**, 0.5 s ISI, 20 stimuli × 4 repetitions per condition per day.
Results: **a dramatic drop in both neural activity and eye fixations after only
the second exposure**, declining further across the week; **partial recovery
overnight** when the stimulus was withheld; and **polymorphic stimuli — same
message, varying symbol, background colour, zoom or jiggle — were substantially
more resistant, keeping that advantage for all five days.** Cross-sectional
work agrees: Anderson et al., "a large drop in visual processing after only the
second exposure"; Bravo-Lillo et al., **only 14% of users noticed a changed
dialog**, and tripling display frequency caused a **threefold decrease** in
that share **[E?]**. From advertising, Chatterjee et al. (2003): **click-through
declines after the first exposure and again after the third** **[E?]**.

**Nothing supports "novel over hours" for a fixed animation.** The only
mechanism with evidence is **polymorphism** — the same event rendering visibly
differently each time, along an axis the viewer's model does not predict; the
four axes that worked for Vance et al. are exactly the four the buddy has.
Separately, **attention is not the same as welcome**: Ofcom, Kantar and IAB
data agree the most attention-grabbing ad formats — non-skippable, forced
audio, interruptive — are also **consistently among the most disliked [IND]**.

## 5. Reactivity and contingency in a social context

The contingency result in `shape-motion-perception.md` (Johnson, Slaughter &
Carey 1998 — contingency alone matched a face) was measured on an infant
one-to-one with an object. Does it survive an audience, on someone else's
screen, where the viewer is not the one being answered?

**The closest direct evidence is encouraging and very small.** Kim, Bruder et
al., *Copresence With Virtual Humans in Mixed Reality* **[E]**, **n = 65**
(41 male, mean age 35.1), 2×2 mixed design. The entire manipulation: **a broom
fell behind the virtual human; in the responsive condition she turned her head
toward it, otherwise she kept mutual gaze and ignored it.** Result: **copresence
responsive M = 4.31 (SE 0.11) vs non-responsive M = 3.96 (SE 0.12),
`F(1,63) = 5.06, p = .02, η² = 0.11`** — and **no significant effect** on
connectedness, plausibility or **liking**. One head-turn toward an event the
character did not cause moved perceived copresence measurably: the cleanest
support the buddy's "look at what happened" behaviour has. Note what did not
move — **contingency buys presence, not affection.**

**Do viewers notice the causality?** No study answers this for stream overlays.
The strongest indirect evidence is **Bongo Cat** — a character whose only
behaviour is reacting to the streamer's keypresses, adopted at scale across
Twitch, YouTube and TikTok. Practitioner accounts converge on viewers
immediately understanding that something happened because the cat moves with
the keyboard **[LORE]**: an existence proof, and nothing more.

**A warning from the AI VTuber corpus study:** appeal ran through **AI–human
interaction**, not the AI alone. Translated: the buddy's causal partner must be
legible as *the streamer's match*, not the buddy performing by itself. The
channel is **streamer → event → buddy**, and the viewer must be able to close
that loop from what is on screen. **Open risk from the lab side:** Tremoulet &
Feldman (2006) found a visible physical cause **suppresses** animacy
attribution, and on a stream the cause is fully visible. My reading is that it
does not apply — an emotional reaction is not a collision — but it is untested,
and it is a real risk.

## 6. Practice: what stream overlays actually do

Surveyed: **Dotabod** (the de facto Dota 2 streaming tool), commercial Dota 2
overlay packs (Kudos.tv, Hexeum), the reactive-pet category (StreamRio,
StreamPet, Tiny Paws), **Bongo Cat**, and general overlay guidance.

**The Dota 2 overlay ecosystem is informational, not affective.** Dotabod's
features: **minimap blocker** (semi-transparent, anti-snipe), **pick blocker**
(progressively reveals heroes as they lock in), **MMR / rank / leaderboard**,
**Roshan and Aegis timers with colour-coded urgency**, **notable-player
callouts under the hero top bar for 2 minutes**, **predictions and polls**,
**win probability**, **queue blocker**, **OBS scene auto-switcher**. Every
visual element is a **blocker** or a **readout**; affect appears only as **chat
text with emoji**. **There is no affective visual channel in the Dota 2 overlay
convention at all** — the niche this project enters, and also why there is **no
prior art and no precedent data**.

**Overlay packs: frame, don't cover** **[LORE]**. Authored at **1920×1080**;
**animated webcam borders, starting/BRB/ending screens, alerts with sound,
Twitch panels, stinger transitions**, arranged **around** the gameplay feed so
**minimap, item slots, ability bar and gold counter stay clear**. Dota packs
converge on dark tones, arcane energy, artifact textures. Design advice is
unanimous and unmeasured: minimalism, generous spacing, and *rapid motion
competes with content and fatigues viewers on long streams*.

**Stream pets exist, and react to the wrong thing.** A commercial category of
persistent animated companions with a shared design **[LORE]**: **idling
between events** (explicitly "not a one-time alert"); **reaction magnitude
scaled by event importance** — small for chat and follows, large for bits,
raids and gifts; a transparent browser source positioned not to obscure
gameplay, camera or chat; chat-command pokes (`!love`, `!pat`). **Critically:
all react to viewer/platform events — follows, subs, bits, gifts. None react to
game state.** Bongo Cat reacts to **input**. **Nobody has shipped a companion
that reacts to what is happening in the match.**

| Practice | Status |
| --- | --- |
| Frame gameplay, never cover the HUD | Convention, and correct — the game is the primary task |
| Tiered reaction magnitude by event weight | Convention; **justified** by animacy/arousal results |
| Persistent idle presence | Convention; **contradicted** by motion-onset — idle should be near-still |
| Minimal, spacious, "earns its place" | Lore; consistent with clutter findings, never tested on streams |
| Corner placement | Lore; the one datum is that right-side did worst in the FIFA20 and banner studies |
| Animated over static | **0.34 pp** — the only measured overlay-animation effect |

One transferable broadcast result: **Brechman, Bellman, Robinson,
Treleaven-Hassard & Varan, *JMCQ* (2015)** **[E?]** — **update tickers beat
scrolling tickers** for recognition of the ticker content *and* the background
programme, with **no difference in perceived clutter or liking**.

## What this means for a reactive Dota buddy

**What will plausibly hold attention over three hours.** First, **onsets, not
loops** — Abrams & Christ is load-bearing here. Attention is bought by **still
→ moving**, so drive idle amplitude to **literal zero** at rest and every
reaction becomes a genuine motion onset; this is the highest-value constraint
in the document. Second, **contingency on visible events**: one head-turn
toward an uncaused event moved copresence by `η² = 0.11` at n = 65, making
"look at what happened" the best-supported behaviour the buddy has — and the
effect was on **presence, not liking**, so do not expect affection. Third,
**polymorphic reactions**: a fixed animation is measurably dead **after its
second showing**, so every reaction class needs visible variation along
symbol / colour / scale / jiggle, the four axes that resisted habituation — a
death reaction identical all nine times is nine repetitions of one stimulus.
Fourth, **tiered magnitude**, already convention in the pet category and
supported by the animacy literature; the full-screen tier is the most
perishable resource on the overlay. Fifth, **a legible chain streamer → event →
buddy**: the buddy's value is that it reacts to *the streamer's* match.

**What will be ignored.** Anything needing foveal inspection — the derived
budget is **~0.65% of fixations, one to two minutes of direct looking across a
three-hour stream** — so everything must survive peripheral, low-spatial-
frequency reading. Detail below **~27 px** equivalent, since the buddy is 7.0%
of frame width and **~35–41% of Twitch views are mobile [IND]**. Slow
aggregates: the PUBG result says the audience reacts to discrete events, so
keeping GPM/XPM off the mood axes is right. And travelling motion — slowest to
notice in the peripheral-display and ticker work.

**What will irritate.** A buddy that never stops moving: it buys nothing and
costs the thing that does. Any element that drifts across the frame — slowest
to notice, animacy-destroying, and named in the lore. Repetition without
variation: the habituation data is unambiguous, and wear-out work adds that
repetition produces **annoyance at the time** even where it produces later
preference. Right-hand placement, marginally — the region that lost in both the
FIFA20 stream and the banner literature. And competing with chat: it took
10.68% against the facecam's 4.60%, and the buddy will lose that contest.

**How much of this is evidence.** §1 — one study, `n = 47`, one game, one
layout, male-only, advertising-funded; the rest derived or borrowed from TV.
§2 — real survey evidence on *why people watch*, **zero on overlays and
retention**. §3 — mascot numbers come from 30-second ads via a vendor with no
published method; the VTuber evidence is decent (`n = 413`, `n = 21`, 244k
comments) and **mildly negative** for "animated character wins attention".
§4 — the strongest section: motion onset, peripheral animation and habituation
are solid experimental psychology, none of it measured on a stream. §5 — one
clean study (`n = 65`) plus an existence proof. §6 — pure practice; only tiered
magnitude and animated-over-static have any measurement behind them.

**Overall: the perceptual mechanics are evidenced, the stream context is not.**
Nobody has measured a reactive character on a game stream. The strongest claim
here is negative and useful: **stop the idle animation at rest, and vary every
repeated reaction** — both cutting against current stream-pet convention.

**Flagged gaps — no data found.** Gaze allocation of **engaged vs background**
stream viewers. Any **overlay → watch-time** measurement, academic or platform.
**Habituation to an affective character** rather than a warning or an ad.
Whether stream viewers **consciously perceive** an overlay's reaction as caused
by a game event. Anything on **companions reacting to game state** — the
category does not exist. **Peripheral eccentricity** at corner placement.

The honest conclusion: **A/B test this on a real stream.** On the question
that matters — does a reactive creature keep people watching — the literature
is silent and the industry is selling.

## Sources

**Peer-reviewed.** [Esports and Visual Attention](https://pmc.ncbi.nlm.nih.gov/articles/PMC9599612/) · [PUBG engagement prediction](https://arxiv.org/abs/2008.07207) · [Why do people watch others play video games?](https://www.sciencedirect.com/science/article/abs/pii/S0747563216307208) · [Copresence with virtual humans](https://pmc.ncbi.nlm.nih.gov/articles/PMC8072477/) · [Motion onset captures attention (2003)](https://journals.sagepub.com/doi/10.1111/1467-9280.01458) · […really does capture attention (2018)](https://link.springer.com/article/10.3758/s13414-018-1548-1) · [Habituation to warnings over time](https://dl.acm.org/doi/10.1145/3025453.3025896) · [Is banner blindness genuine?](https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.1742) · [Peripheral animation evaluation](https://people.cs.vt.edu/~mccricks/papers/thesis-chap/node5.html) · [Animation and information seeking](https://aisel.aisnet.org/jais/vol1/iss1/1/) · [Which ticker format works best?](https://dx.doi.org/10.1177/1077699015604851) · [Second-screen viewing and learning](https://www.sciencedirect.com/science/article/abs/pii/S0747563214002994) · [Entertainers between real and virtual](https://arxiv.org/abs/2504.09018) · [VTubers vs FaceCam](https://stars.library.ucf.edu/etd2020/1535/) · [Perceiving AI-driven VTubers](https://arxiv.org/html/2509.20817v1) · [AI VTuber fandom](https://arxiv.org/abs/2509.10427) · [Esports experts' gaze](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0288770)

**Industry and practice.** [System1 fluent devices](https://system1group.com/blog/introducing-fluent-devices) · [System1 character research](https://lbbonline.com/news/research-by-system1-shows-memorable-characters-in-ads-boost-chances-of-profit-by-30) · [Attention formats irritate](https://www.marketingweek.com/attention-formats-irritate/) · [Dotabod features](https://github.com/dotabod/frontend/blob/master/features.md) · [Dotabod](https://dotabod.com/) · [StreamRio pets](https://streamrio.com/stream-pets) · [Tiny Paws](https://ratevoid.itch.io/tiny-paws-reactive-pet-overlay) · [Bongo Cat / Overlay Cat](https://overlaycat.com/) · [Kudos.tv Dota 2 overlays](https://kudos.tv/collections/dota2-overlays) · [Overlay design: what to avoid](https://getrektlabs.com/blogs/news/choose-your-stream-overlays-where-to-start-what-to-avoid) · [Muxy on Extensions (unsourced claim)](https://www.muxy.io/post/what-are-twitch-extensions-and-why-do-they-matter) · [TiVo multitasking survey 2015](https://s21.q4cdn.com/329092987/files/doc_news/Distracted-but-Still-Watching-TiVo-Survey-Finds-99-Percent-of-Viewers-Are-Multitasking-While-Watching-TV-2015.pdf)
