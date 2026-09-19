# Face perception for a 135 px creature

Research note for the buddy redesign (`.scratch/buddy-redesign/spec.md`): how to
build something that reads as a warm companion, carries a continuous
valence x arousal state, and survives at 135 px under ADR-0003 (opaque geometry,
crisp edges, no glow, no partial alpha). Claims are tiered — **[A]** peer-reviewed
primary result as its authors state it; **[B]** defensible inference
(extrapolation, or animal/HRI work applied to a screen creature); **[C]** design
lore with no experimental backing. Where popular intuition and evidence disagree,
it is flagged. Several do.

## 0. The size problem, quantified

135 CSS px inside a 1920-wide stream actually becomes:

| Viewing case | scale | device px | angular size |
| --- | ---: | ---: | ---: |
| Laptop 13", windowed at 60 % | 0.47 | 64 | 1.26 deg |
| Phone portrait, full-width video | 0.61 | 83 | 0.82 deg |
| Laptop 13", fullscreen | 0.79 | 106 | 2.09 deg |
| Desktop 27", fullscreen (best) | 1.33 | 180 | 3.43 deg |

A human face at conversational distance (15 cm at 1 m) subtends **8.6 deg**, a
single human eye **1.7 deg**. The *entire creature* is therefore between one half
and two times the angular size of **one human eye** in conversation, with **~64-83
usable pixels** worst case, before stream compression. Two consequences follow:
affect must survive ~64 px, and this is not a face at normal distance but a face
seen from ~8 m — a real regime with real literature.

## 1. Minimal face: what triggers detection

Face detection is standardly described as depending on **first-order relations** —
the coarse T-shaped arrangement of two eyes above a mouth. That is what lets
pareidolia work: an object sharing the arrangement activates the face template. [A]

The strongest direct measurement is Omer, Sapir, Hatuka & Yovel (2019): 116
inanimate objects that produce a face percept, 35 participants rating "faceness",
and a **separate** group rating 12 facial features so the predictors were not
contaminated by the faceness judgement. Regression explained **92 % of the
variance**, and only two features contributed significantly: [A]

| Feature | beta | t | p |
| --- | ---: | ---: | ---: |
| **Eyes** | .49 | 7.05 | < .001 |
| **Mouth** | .27 | 3.15 | .002 |
| Eyebrows / hair | .10 / .08 | | .015 / .029 (marginal) |
| Expressiveness, nose, proportion, symmetry, teeth, ears, frame, forehead | | | n.s. |

Experiment 2 confirmed causally: removing **eyes or mouth** significantly reduced
faceness; removing **ears or teeth did not**. [A] Note what is *not* significant —
symmetry, proportion, nose, outline: detection tolerates distortion far better
than deletion.

**The innate template is weaker than usually claimed.** Newborn face preference is
substantially explained by a non-specific bias toward **top-heavy** patterns,
face-like or not (Simion et al. 2002), though later work contests it [A,
contested]; and face cells respond to illusory faces largely via **non-holistic
object parts** (Wardle et al. 2023), so pareidolia buys detection, not the whole
social-face machinery. [A]

**A single central eye.** There is **no experimental literature** on whether one
central eye is detected as a face. Structurally: the faceness model rests on eyes
plus a mouth and never tests cardinality [A]; a lone circular form, centrally
placed, with no mouth and no top-heaviness, satisfies **none** of the first-order
cues [B]; what it does satisfy is the description of an **eyespot** (§2) [B]. **So
it is most likely detected as an eye — an object — not a face.** The spec's
mitigation ("a creature with an eye, not an eye in a void") is sound but
under-specified: a body that is not top-heavy and carries no mouth-analogue adds
silhouette without adding faceness.

## 2. One eye vs two

**Lore.** "One eye = evil" is cultural: Polyphemus, Sauron, HAL 9000, the evil
eye. The perception literature on cyclopean-form threat is mythology and film
criticism, not experiments — **no evidence** that a one-eyed form is inherently
threatening or uncanny perceptually. **[C]**

**Evidence**, and the first finding cuts against the intuition. *Paired spots are*
more *alarming than single ones*: Mukherjee & Kodandaramaiah (2015) gave chickens
paper butterfly models, and those bearing **a pair** of patterns suffered **fewer
attacks than a single pattern of equal total area** — symmetric or asymmetric,
eye-like or not. [A] Eyespot efficacy is driven by **conspicuousness** (size, spot
count, contrast) rather than eye mimicry (Stevens et al. 2008). [A] Where one-vs-two
has been tested with area controlled, **two beats one at signalling "a watcher is
here"**; doubling the eye would not reduce watchfulness. [B]

*A pair of eyes alone makes humans feel watched.* Eye imagery above an honesty box
roughly tripled contributions (Bateson, Nettle & Roberts 2006); eye images on
collection buckets raised donations ~48 %. [A, magnitude contested] **Static eye
imagery reads as surveillance**, for one eye and two alike — the real risk here.
And the threat signal inside an eye is **sclera area, not eye count**: Whalen et
al. (2004) showed masked images of eye whites alone, large (fearful) vs small
(happy), differentially driving amygdala response below awareness. [A]

**What actually makes a face friendly vs threatening is geometric, and none of it
is about eye count.** Larson, Aronoff & Stearns (2007) found **downward-pointing
V** shapes — the geometry of an angry brow — detected faster across five
visual-search experiments, and the same shape drives greater amygdala, sgACC and
fusiform activation than an identical upward V (Larson et al. 2009). [A] Angular
and diagonal forms read as threatening, rounded forms as warm (Aronoff et al.);
sharp-contoured objects are liked less than curved ones (Bar & Neta 2006). [A]

**Friendliness comes from curvature, upward-tilted contours, low sclera exposure
and a non-surveilling gaze pattern — not from two eyes.** Two eyes buy *faceness*,
not *warmth*, and per the eyespot work may buy *more* watchfulness. The creepiness
of the current single eye is probably misdiagnosed as a cardinality problem when
it is a **category** problem: an isolated circular high-contrast form is an
eyespot, and eyespots are alarms.

## 3. Emotion from facial geometry, ranked

| Cue | Carries | Source |
| --- | --- | --- |
| 1. **Mouth curvature** | valence; happiness & surprise | Smith et al. 2005 [A] |
| 2. **Eye/lid aperture** | arousal, alertness, sensitivity | Lee & Anderson 2017 [A] |
| 3. **Brow position & angle** | anger/threat, negative valence | Larson 2007 [A] |
| 4. **Sclera area** | fear/threat, high arousal | Whalen 2004 [A] |
| 5. **Pupil size** | sadness only (weak, asymmetric) | Harrison et al. 2006 [A] |

Smith, Cottrell, Gosselin & Schyns (2005) decomposed faces into five one-octave
spatial-frequency bands (120-60, 60-30, 30-15, 15-7.5, 7.5-3.8 cycles/image) and
used Bubbles to locate diagnostic information: **the mouth is diagnostic for
happiness and surprise, the eyes for fear**, with an observer bias to the
lower-forehead/eyebrow intersection for anger; happiness and surprise are the most
efficiently transmitted and decoded. [A] Pupil size is weak and one-directional —
smaller pupils raised perceived intensity of *sad* faces only. [A] Eyebrows matter
disproportionately for **identity**, not emotion (Sadr, Jarudi & Sinha 2003), so
do not transfer that claim. [A, other task] "Eye aspect ratio" is a
computer-vision blink metric; the real construct is **lid aperture**. [C / A]

**What survives small size and low resolution** — the answer is reassuring:

- Du & Martinez (2011), via Martinez & Du (2012): **joy and surprise are robustly
  identified at almost any resolution** — their illustration runs faces down to
  **30 x 20 px** with the happy expression still obvious. **Anger and sadness are
  reliable only at close proximity; fear and disgust are poorly recognised even
  under favourable conditions.** This is *not* explained by amount of deformation:
  surprise deforms most, but so do disgust and fear. [A]
- Hager & Ekman (1979): observers at **30-45 m** labelled posed expressions above
  chance, live and photographed alike. A 15 cm face at 45 m subtends **~0.19 deg**,
  an order of magnitude smaller than our buddy. [A; posed extremes, 6AFC]
- Faces support recognition down to **~16 x 16 px**, scenes to **32 x 32 px**
  (Bachmann 1991; Harmon & Julesz 1973; Torralba 2009). [A]

**At what size do brows and mouth stop contributing?** No paper gives a threshold.
Reconstruction [B]: a feature carries information only to the Nyquist limit of the
pixels spanning it, and Smith et al.'s diagnostic information sits in mid bands,
so ~8-12 cycles across the face implies **~16-24 px across the face region** as a
floor. Practically, a **mouth arc needs ~20 px width** for its sign to be readable
and a **brow ~20 px width plus ~3 px vertical travel** for its angle to register.
Below ~12-15 px of span a feature is a dot: presence only.

## 4. Valence and arousal specifically

Good news for ADR-0001: **the circumplex was partly derived *from* facial
expression judgements**, so the mapping is not a retrofit. Russell & Bullock (1985)
applied multidimensional scaling to judgements of emotional faces and recovered a
**two-dimensional structure (pleasure/displeasure, high/low arousal)** identical
from three-year-olds to adults. [A] Martinez & Du (2012) add that the continuous
model explains the caricature effect — features farther from the mean are easier
to read, a direct argument for exaggerated geometry. [A]

**Valence — mouth curvature (primary), brow angle (secondary).** Talamas, Mavor &
Perrett (2016) independently manipulated **eyelid-openness** and **mouth
curvature** in real faces; each had its own effect, mouth curvature reading as
**mood** and eyelid-openness as **alertness**. [A] In automated-FACS work on
continuous affect, **AU12 (lip corner puller) correlates positively and AU4 (brow
lowerer) negatively** with dynamic valence. [A, computational]

**Arousal — aperture (primary), motion (primary).** Lee & Anderson (2017) showed
**eye widening vs narrowing** — the optical trade-off between sensitivity and
acuity — conveys an axis accounting for **61.7 % of the variance** in perceived
mental states, spanning widened states (awe, fear, wonder) against narrowed ones
(suspicion, disgust, scrutiny). [A] Strictly it is a sensitivity-vs-discrimination
axis, close to but not identical with arousal, and widening also raises sclera
exposure, itself a threat channel. [A]

**Motion is an independent arousal carrier, under-exploited here.** Saerbeck &
Bartneck (2010) varied robot motion systematically: **acceleration predicts
perceived arousal**, while **valence is carried partly by an interaction of
acceleration and curvature**. [A, robot motion] That supports the spec's
assignment of speed and amplitude to arousal — and identifies **path curvature**
as a second, currently unassigned valence channel.

**Important asymmetry:** the cues surviving small size best (mouth curvature,
gross aperture) are exactly the **valence and arousal** cues; those failing first
(fear, disgust, subtle brows) are *discrete category* cues. The circumplex is the
model best suited to a tiny creature. [B]

## 5. Eye contact and gaze

**Direct gaze captures attention and raises arousal.** Skin conductance is elevated
to direct gaze relative to averted gaze or closed eyes, and — contrary to earlier
speculation — this occurs **irrespective of gaze duration**. [A]

**But the effect largely requires a believed-live watcher.** Contrasting a live
person with a picture or video, the autonomic eye-contact effect is limited to the
live case: a picture's gaze direction did not modulate arousal, and N170
enhancement appeared only for a live face (Pönkänen et al. 2011). [A] **This
substantially de-risks the overlay** — a rendered creature is not a live watcher,
so staring-discomfort physiology should not be naively imported. What remains is
the *phenomenological* watching-eyes association (§2). [B] Preferred mutual gaze
is nonetheless short and measurable: a mean of **3.3 s**, with pupil dilation
tracking it (Binetti et al. 2016). [A]

**Does blinking or aversion help?** Direct evidence is HRI, not basic perception: a
very low gaze-aversion ratio produced **shorter interactions**, a **prolonged robot
stare increased arousal**, head-turn aversion read as **thoughtful**, and
inappropriate gaze cues **uncanniness**. [B, HRI] In humans, gaze aversion
regulates turn-taking, intimacy and cognitive load. [A] **Blinking has no evidence
for reducing discomfort** [C]; its defensible role is **stare interruption and
animacy** — cheap in pixels and still worth it. [B]

## 6. Baby schema (Kindchenschema)

Lorenz (1943) proposed that infantile features — large head relative to body,
protruding forehead, **large eyes below the head's vertical midline**, round
cheeks, rounded body — act as innate releasers for caretaking. [A, theoretical]
Parametric confirmation:

- Sternglanz, Gray & Murakami (1977) varied **eye height, eye width, iris size and
  vertical feature position** in full-face line drawings; preferences were highly
  significant and stable across social class and childcare experience. Preferred:
  **large forehead, small chin, large eyes**. [A]
- Alley (1981): cuteness tracks **head shape** — large cranial vault, protuberant
  forehead — and declines as the profile matures. [A]
- Glocker et al. (2009) built high / unmanipulated / low baby-schema versions of 17
  infant faces anthropometrically. **High = round face, high forehead, big eyes,
  small nose and mouth; low = the inverse.** Higher baby schema raised cuteness
  ratings *and* caretaking motivation [A]; the companion fMRI study found graded
  **nucleus accumbens** activation — reward and approach motivation, not just
  aesthetic judgement. [A]

**Concrete ratios.** That literature gives direction, not canonical numbers. The
most-cited figures are Gould's 1979 measurement of Mickey Mouse's redesign toward
neoteny — a real measurement in a popular essay: **eye length grew from 27 % to
42 % of head length**, **head length from 42.7 % to 48.1 % of body length**. [A
measurement, C causal claim]

**Ceiling effect — the actionable nuance.** Bigger is not monotonically cuter.
Seyama & Nagayama (2007) found no uncanny valley in morphed faces **until they
enlarged the eyes**: a **50 % eye enlargement combined with human texture and
proportions produced strongly elevated eeriness**, while **the same exaggerated
proportions with a doll's texture were not eerie**. [A] The eeriness is a
**mismatch** effect, not an eye-size effect — so opaque, crisp-edged, stylised
geometry, exactly what ADR-0003 forces on us, is the regime where large eyes are
*safe*. Constraint and warmth goal align.

## What this means for a 135 px creature

Sizes are **CSS px at 135 px nominal**; scale by 0.47-0.61 for §0's worst case.

### Spend the pixel budget here

**1. Give it a mouth-analogue — the highest-value single change.** It is the #2
faceness predictor [A], the #1 valence carrier [A], and the cue that survives
30 x 20 px [A]. Without it the form is an eyespot, not a face. Budget **>= 20 px
wide, >= 3 px stroke**, with **>= 4 px of arc sag** between full-negative and
full-positive valence so the curve's sign is unmistakable at 0.8 deg. It need not
be a mouth: any horizontal element **below** the eye whose **curvature** is
affect-driven satisfies the first-order relation — a mouth-line, a jaw contour, or
the leading edge of the body.

**2. Fix the eyespot problem by category, not cardinality.** Doubling the eye is
not indicated: paired spots are *more* alarming at equal area [A] and the
watching-eyes effect fires for pairs [A]. What defuses an eyespot is stopping it
being an isolated high-contrast circle.

- **Break the circle** — a lid occluding the top of the eye at rest kills the
  concentric-ring eyespot signature.
- **Keep sclera exposure low by default.** Never show light all the way around the
  pupil in the calm/positive region; that is the Whalen fear signal [A]. Reserve a
  full ring for high-arousal-negative spikes, where it is *correct*.
- **Make the silhouette top-heavy** — upper-half mass is the newborn bias [A,
  contested] and the cheapest faceness cue available.

**3. Curvature everywhere — free warmth.** Rounded contours read warm, angular and
diagonal ones threatening [A]; the downward V is a pre-attentive threat shape [A].
Pure silhouette work, zero pixel cost. **No downward-pointing V anywhere in the
resting silhouette** — not lid, brow, body, or orbit crossings. Let the negative
pose be the *only* place one appears, so it is a signal, not a constant.

**4. Motion for arousal, path curvature for valence.** Acceleration predicts
arousal; acceleration x curvature carries valence [A, robot motion]. Motion has no
resolution floor — it works at 64 px as well as at 400 px. The spec assigns speed
and amplitude to arousal but leaves path curvature unassigned: **assign it —
smooth rounded paths for positive valence, jagged angular paths for negative.**

### Proportions

From the baby-schema literature [A], anchored with Gould's numbers [A/C]:

- **Eye diameter 35-45 % of head width.** Gould's Mickey landed at 42 %; below
  ~30 % the releaser weakens. Large is safe here **because** the texture is flat
  opaque geometry, not photorealism — precisely the condition under which
  exaggerated eyes were *not* eerie [A].
- **Eye vertical centre at or slightly below the head's midline** (~50-55 % of head
  height) — the Lorenz/Sternglanz prescription [A], which also gives top-heavy mass.
- **Head 40-50 % of total body length** (Gould: 42.7 % -> 48.1 %) [A/C], with the
  **cranial vault above the eyes >= the eyes-to-base distance**. [A]
- At 135 px total, a head at ~45 % of a ~120 px creature is ~54 px and an eye at
  40 % of head width is **~22 px** — above the ~12-15 px floor where a feature
  degrades to a dot [B], even at the phone worst case (~13 device px).

### Gaze, and what to drop

- **Do not make viewer-directed gaze the resting default**; preferred mutual gaze
  is ~3.3 s [A]. The spec has the buddy watching the viewer at rest — invert it:
  **watch the game by default, glance at the viewer in 2-4 s beats**, and avert on
  death [B, HRI]. **Blink** as an animacy and stare-interruption cue [B], not as a
  proven creepiness fix [C].
- **Drop pupil size as an affect channel.** Weak, sad-only, and at ~22 px of eye it
  cannot resolve meaningful diameter steps. [A + B]
- **Drop fear and disgust as target expressions.** Poorly recognised even at full
  size under good conditions [A]. The negative-high-arousal corner should read as
  *alarm/tension* via aperture, sclera and motion — not as a fear face.
- **Drop fine brow articulation.** A brow needs ~20 px width and ~3 px vertical
  travel to register [B]; without that, fold its job into **lid angle**, which
  already carries aperture.
- **Drop symmetry and precise proportion as goals.** Both are non-significant
  predictors of faceness [A]. Spend the effort on eyes, mouth-analogue, curvature.

## References

Alley, T. R. (1981). Head shape and the perception of cuteness. *Developmental Psychology*, 17, 650-654. — and Aronoff, J., Woike, B. A., & Hyman, L. M. (1992). Which are the stimuli in facial displays of anger and happiness? *JPSP*, 62, 1050-1066. — and Bar, M., & Neta, M. (2006). Humans prefer curved visual objects. *Psychological Science*, 17, 645-648.
Bateson, M., Nettle, D., & Roberts, G. (2006). Cues of being watched enhance cooperation in a real-world setting. *Biology Letters*, 2, 412-414.
Binetti, N., Harrison, C., Coutrot, A., Johnston, A., & Mareschal, I. (2016). Pupil dilation as an index of preferred mutual gaze duration. *Royal Society Open Science*, 3, 160086.
Du, S., & Martinez, A. M. (2011). The resolution of facial expressions of emotion. *Journal of Vision*, 11(13):24. — summarised in Glocker, M. L., Langleben, D. D., Ruparel, K., Loughead, J. W., Gur, R. C., & Sachser, N. (2009). Baby schema in infant faces induces cuteness perception and motivation for caretaking in adults. *Ethology*, 115, 257-263. — and: Baby schema modulates the brain reward system in nulliparous women. *PNAS*, 106, 9115-9119.
Gould, S. J. (1979). A biological homage to Mickey Mouse. *Natural History*, 88(5).
Hager, J. C., & Ekman, P. (1979). Long-distance transmission of facial affect signals. *Ethology and Sociobiology*, 1, 77-82.
Harrison, N. A., Singer, T., Rotshtein, P., Dolan, R. J., & Critchley, H. D. (2006). Pupillary contagion: central mechanisms engaged in sadness processing. *SCAN*, 1, 5-17.
Larson, C. L., Aronoff, J., & Stearns, J. J. (2007). The shape of threat. *Emotion*, 7, 526-534. — and Larson, Aronoff, Sarinopoulos & Zhu (2009). Recognizing threat: a simple geometric shape activates neural circuitry for threat detection. *JoCN*, 21, 1523-1535.
Lee, D. H., & Anderson, A. K. (2017). Reading what the mind thinks from how the eye sees. *Psychological Science*, 28, 494-503.
Lorenz, K. (1943). Die angeborenen Formen möglicher Erfahrung. *Zeitschrift für Tierpsychologie*, 5, 235-409.
Martinez, A., & Du, S. (2012). A model of the perception of facial expressions of emotion by humans. *JMLR*, 13, 1589-1608. — on low-resolution limits see also Torralba, A. (2009). How many pixels make an image? *Visual Neuroscience*, 26, 123-131.
Mukherjee, R., & Kodandaramaiah, U. (2015). What makes eyespots intimidating — the importance of pairedness. *BMC Evolutionary Biology*, 15, 34.
Omer, Y., Sapir, R., Hatuka, Y., & Yovel, G. (2019). What is a face? Critical features for face detection. *Perception*, 48, 437-446.
Pönkänen, L. M., Alhoniemi, A., Leppänen, J. M., & Hietanen, J. K. (2011). Does it make a difference if I have an eye contact with you or with your picture? *SCAN*, 6, 486-494.
Russell, J. A., & Bullock, M. (1985). Multidimensional scaling of emotional facial expressions. *JPSP*, 48, 1290-1298. — and Russell, J. A. (1980). A circumplex model of affect. *JPSP*, 39, 1161-1178.
Sadr, J., Jarudi, I., & Sinha, P. (2003). The role of eyebrows in face recognition. *Perception*, 32, 285-293.
Saerbeck, M., & Bartneck, C. (2010). Perception of affect elicited by robot motion. *HRI '10*. — and Seyama, J., & Nagayama, R. S. (2007). The uncanny valley: effect of realism on the impression of artificial human faces. *Presence*, 16, 337-351.
Simion, F., Valenza, E., Macchi Cassia, V., Turati, C., & Umiltà, C. (2002). Newborns' preference for up-down asymmetrical configurations. *Developmental Science*, 5, 427-434. — and Macchi Cassia, Turati & Simion (2004). *Psychological Science*, 15, 379-383.
Smith, M. L., Cottrell, G. W., Gosselin, F., & Schyns, P. G. (2005). Transmitting and decoding facial expressions. *Psychological Science*, 16, 184-189.
Sternglanz, S. H., Gray, J. L., & Murakami, M. (1977). Adult preferences for infantile facial features. *Animal Behaviour*, 25, 108-115.
Stevens, M., Hardman, C. J., & Stubbins, C. L. (2008). Conspicuousness, not eye mimicry, makes "eyespots" effective antipredator signals. *Behavioral Ecology*, 19, 525-531.
Talamas, S. N., Mavor, K. I., & Perrett, D. I. (2016). Eyelid-openness and mouth curvature influence perceived intelligence beyond attractiveness. *JEP: General*, 145, 603-620.
Torralba, A. (2009). How many pixels make an image? *Visual Neuroscience*, 26, 123-131.
Wardle, S. G., et al. (2023). When the whole is only the parts: non-holistic object parts predominate face-cell responses to illusory faces. *Nature Communications*.
Whalen, P. J., et al. (2004). Human amygdala responsivity to masked fearful eye whites. *Science*, 306, 2061.
