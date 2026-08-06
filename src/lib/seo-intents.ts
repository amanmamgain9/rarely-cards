export type SeoIntent = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  accent: string;
  intro: string;
  image: string;
  imageAlt: string;
  socialImage: string;
  socialImageAlt: string;
  quote: string;
  proofTitle: string;
  proofCopy: string;
  steps: Array<{ title: string; copy: string }>;
  notesTitle: string;
  notesIntro: string;
  notes: Array<{ title: string; copy: string }>;
  ideasTitle: string;
  ideasIntro: string;
  ideas: Array<{ title: string; copy: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export const talkingPetVideo: SeoIntent = {
  path: "/talking-pet-video",
  title: "AI Talking Pet Video Generator",
  description:
    "Turn one pet photo and a line you choose into an eight-second AI talking-pet video with sound. Three videos for $10, with no subscription.",
  eyebrow: "AI TALKING PET VIDEO GENERATOR",
  headline: "AI Talking Pet Video Generator",
  accent: "",
  intro:
    "Upload one clear cat or dog photo, choose a line inspired by the look—or write your own—and Rarely turns it into a vertical talking-pet video made to save, send, or post.",
  image: "/pets/window-cat.jpg",
  imageAlt: "Cat looking through a window, ready to become a talking-pet video",
  socialImage: "/social/og-talking-pet.jpg",
  socialImageAlt: "Make your pet talk with Rarely using one photo and your own words",
  quote: "I was watching the sunset. You interrupted.",
  proofTitle: "How does an AI talking pet video work?",
  proofCopy:
    "Upload one clear cat or dog photo, choose a short line, and Rarely creates an eight-second vertical MP4 with synchronized speech and sound.",
  steps: [
    { title: "Choose their photo", copy: "Use a clear photo where their face and expression feel unmistakably like them." },
    { title: "Pick their line", copy: "Choose a photo-specific suggestion or type your own line, up to 120 characters." },
    { title: "Save the video", copy: "Get an eight-second vertical MP4 with sound, ready for your camera roll or group chat." },
  ],
  notesTitle: "What makes the result believable?",
  notesIntro:
    "The model can create movement and speech, but the source photo and line still determine whether the result feels like your pet or like a generic animation.",
  notes: [
    { title: "Keep the face readable", copy: "Use one cat or dog with the eyes, muzzle, and outline of the head visible. Heavy blur, tiny subjects, covered faces, and multiple prominent pets give the model less identity to preserve." },
    { title: "Match the line to the frame", copy: "A pet staring at a bowl supports a food complaint; a pet at a window supports an observation. Lines grounded in something visible usually feel more convincing than an unrelated joke." },
    { title: "Write for eight seconds", copy: "Short speech sounds cleaner. Aim for one compact sentence that can be said naturally without rushing, even though the text field allows up to 120 characters." },
  ],
  ideasTitle: "What can a talking-pet video say?",
  ideasIntro: "The strongest lines sound like the voice you already use for them.",
  ideas: [
    { title: "The inner monologue", copy: "Turn side-eye, a stolen seat, or a suspicious silence into the sentence behind the look." },
    { title: "The household announcement", copy: "Let them address dinner delays, new rules, visitors, or the other pet directly." },
    { title: "The tiny greeting", copy: "Make a short hello, thank-you, birthday line, or just-because message people will replay." },
  ],
  faqs: [
    { question: "What is an AI talking-pet video?", answer: "It is a short video made from a still pet photo in which the pet appears to say a line you choose. Rarely creates an eight-second vertical MP4 with synchronized speech." },
    { question: "Can I choose exactly what my pet says?", answer: "Yes. You can pick one of Rarely's suggestions or write your own line of up to 120 characters." },
    { question: "Does Rarely work with cats and dogs?", answer: "Yes. Use one clear cat or dog photo in JPEG, PNG, or WebP format." },
    { question: "How much does it cost?", answer: "A one-time $10 purchase includes three talking-pet video credits. There is no subscription." },
  ],
};

export const makeDogTalk: SeoIntent = {
  path: "/make-dog-talk",
  title: "Make Your Dog Talk With AI",
  description:
    "Make your dog talk from one photo. Choose the words and get an eight-second vertical talking-dog video with sound from Rarely.",
  eyebrow: "MAKE YOUR DOG TALK",
  headline: "Make Your Dog Talk With AI",
  accent: "",
  intro:
    "Choose the grin, guilty stare, dramatic nap, or dinner-time face everyone recognizes. Add the words, and Rarely turns that one dog photo into a short talking video.",
  image: "/pets/quiet-dog.jpg",
  imageAlt: "Beagle looking at the camera for a talking-dog video",
  socialImage: "/social/og-talking-dog.jpg",
  socialImageAlt: "Make your dog talk with Rarely using one photo and your own words",
  quote: "I heard the rule. I simply rejected it.",
  proofTitle: "How do I make my dog talk in a video?",
  proofCopy:
    "Choose a clear dog photo, select a suggested line or write your own, and generate an eight-second talking-dog video with sound.",
  steps: [
    { title: "Find the doggiest photo", copy: "Pick a clear expression, with the eyes and muzzle visible and as little blur as possible." },
    { title: "Write their side of it", copy: "Use a suggested line or write the sentence your dog would absolutely say." },
    { title: "Send it to the group chat", copy: "Download the finished 9:16 MP4 or share it from your phone." },
  ],
  notesTitle: "How to get a stronger talking-dog clip",
  notesIntro:
    "Dog faces move a lot even in still photos. Choose a frame where the expression is clear before asking the video to add speech.",
  notes: [
    { title: "Show the muzzle", copy: "A front-facing or gentle three-quarter angle gives the animation a clear mouth shape. Avoid hands, toys, blankets, or deep shadow covering the lower face." },
    { title: "Use the situation", copy: "The couch, leash, empty plate, open car door, or guilty evidence already supplies the premise. Write the dog's response to that visible moment instead of forcing a random meme line." },
    { title: "Keep the delivery simple", copy: "One sentence works better than a setup and punchline. Read it aloud once: if you naturally rush, shorten it before generating the video." },
  ],
  ideasTitle: "Dog photos that work especially well",
  ideasIntro: "Choose personality over perfection. A specific moment gives the line somewhere to land.",
  ideas: [
    { title: "The guilty face", copy: "The evidence is nearby. The dog would still like to make a statement." },
    { title: "The treat stare", copy: "A direct gaze and a very clear negotiating position need almost no introduction." },
    { title: "The stolen spot", copy: "Your chair, your pillow, your side of the bed—apparently all part of their estate." },
  ],
  faqs: [
    { question: "How do I make my dog talk in a video?", answer: "Upload one clear dog photo, choose or write a short line, and use one Rarely video credit to generate the finished clip." },
    { question: "What kind of dog photo should I use?", answer: "Use a sharp JPEG, PNG, or WebP where the dog's face is visible. A photo with a recognizable expression or situation usually gives you the best line to work with." },
    { question: "Can I write my own dog voice line?", answer: "Yes. You can write any line you are allowed to use, up to 120 characters, or choose a suggestion inspired by the photo." },
    { question: "Is there a subscription?", answer: "No. Three talking-dog videos cost $10 as a one-time purchase." },
  ],
};

export const makeCatTalk: SeoIntent = {
  path: "/make-cat-talk",
  title: "Make Your Cat Talk With AI",
  description:
    "Turn one cat photo into a talking-cat video. Pick the perfect line and get an eight-second vertical MP4 with sound from Rarely.",
  eyebrow: "MAKE YOUR CAT TALK",
  headline: "Make Your Cat Talk With AI",
  accent: "",
  intro:
    "Upload the stare, loaf, window watch, or carefully staged act of indifference. Choose what your cat says and turn the photo into a tiny talking-cat video.",
  image: "/pets/window-cat.jpg",
  imageAlt: "Cat watching the sunset for a talking-cat video",
  socialImage: "/social/og-talking-cat.jpg",
  socialImageAlt: "Make your cat talk with Rarely using one photo and your own words",
  quote: "This meeting could have been an open can.",
  proofTitle: "How do I make my cat talk in a video?",
  proofCopy:
    "Upload a clear cat photo, choose the words, and generate an eight-second talking-cat video with synchronized speech and sound.",
  steps: [
    { title: "Choose the stare", copy: "Pick a clear photo with visible eyes and face—side-eye and dramatic lighting are welcome." },
    { title: "Approve the statement", copy: "Choose a suggestion or enter the exact complaint, demand, or observation you hear." },
    { title: "Release it publicly", copy: "Save the vertical MP4, send it privately, or let the internet hear the verdict." },
  ],
  notesTitle: "How to keep a talking cat looking like your cat",
  notesIntro:
    "Cats communicate through small changes in eyes, ears, posture, and stillness. A restrained source image gives those details room to survive the animation.",
  notes: [
    { title: "Prioritize eyes and muzzle", copy: "Choose a sharp frame with the face large enough to read. Extreme profiles, closed eyes, motion blur, and paws covering the mouth make synchronized speech less reliable." },
    { title: "Let the stare do the work", copy: "Cat humor usually lands through understatement. Connect the line to the bowl, keyboard, window, box, bed, or person already present in the photograph." },
    { title: "Prefer dry, short lines", copy: "A concise verdict or demand fits the still expression better than a long speech. Keep punctuation simple so the spoken rhythm stays natural." },
  ],
  ideasTitle: "Cat moments worth giving a voice",
  ideasIntro: "The photo does not need to be posed. Ordinary cat politics are usually better.",
  ideas: [
    { title: "The window monologue", copy: "Bird surveillance, neighborhood affairs, and one interrupted sunset." },
    { title: "The empty bowl case", copy: "Dinner happened. Your cat may dispute that version of events." },
    { title: "The occupied keyboard", copy: "A concise explanation of why your work is less important than this nap." },
  ],
  faqs: [
    { question: "How can I make my cat talk from a photo?", answer: "Upload one cat photo to Rarely, choose a suggested line or write your own, and generate an eight-second talking-cat video." },
    { question: "Does my cat need to face the camera?", answer: "A clear view of the face works best, but the photo can still include the surrounding scene. Avoid heavy blur or a face hidden by an object." },
    { question: "Can the cat say my own words?", answer: "Yes. Write a line of up to 120 characters or use one inspired by the photo." },
    { question: "Can I download the video?", answer: "Yes. Completed videos are vertical MP4 files with sound that you can download or share." },
  ],
};

export const petBirthdayVideo: SeoIntent = {
  path: "/pet-birthday-video",
  title: "Personalized Pet Birthday Video",
  description:
    "Turn one to six real pet photos into a personalized birthday video. One pet delivers your message and the whole crew finishes with natural celebratory meows.",
  eyebrow: "PERSONALIZED PET BIRTHDAY VIDEO",
  headline: "Personalized Pet Birthday Video",
  accent: "",
  intro:
    "Bring one to six familiar pets into a single candid birthday scene. One delivers your exact greeting while the others stay naturally themselves—and the whole crew joins the finish.",
  image: "/pets/golden-dog.jpg",
  imageAlt: "Golden dog in flowers for a personalized pet birthday video",
  socialImage: "/social/og-pet-birthday.jpg",
  socialImageAlt: "Create a personalized pet birthday video with one to six pets",
  quote: "Happy birthday. I got you the gift of my presence.",
  proofTitle: "How does a personalized pet birthday video work?",
  proofCopy:
    "Add one to six cat or dog photos, enter the recipient's name and greeting, approve the group portrait, and generate the birthday video.",
  steps: [
    { title: "Add the whole cast", copy: "Choose one to six clear pet photos the recipient will recognize immediately." },
    { title: "Approve the birthday scene", copy: "Rarely brings them together with different poses and eyelines in one candid portrait." },
    { title: "Write the birthday line", copy: "One pet speaks your exact message; the others finish with an untidy celebratory reaction." },
  ],
  notesTitle: "Build the birthday message around the recipient",
  notesIntro:
    "The useful part is not merely making an animal move. It is choosing a recognizable pet, a personal line, and a delivery that fits how the video will be shared.",
  notes: [
    { title: "Name the recipient", copy: "Put the person's name near the beginning of the line so the greeting feels direct immediately. Keep the rest short enough to sound like a toast rather than a speech." },
    { title: "Use a real household joke", copy: "Reference walks, breakfast, lap access, stolen pillows, or another harmless ritual the recipient will recognize. Specificity makes a simple eight-second clip feel personal." },
    { title: "Choose clear source photos", copy: "Use one photo per pet with the face and markings easy to see. The sources can be ordinary—the generated scene supplies the party." },
  ],
  ideasTitle: "Birthday lines with more personality",
  ideasIntro: "Keep it short enough to land like a toast, not a speech.",
  ideas: [
    { title: "From their own pet", copy: "A thank-you for the walks, snacks, lap access, and excellent staff performance." },
    { title: "From your pet", copy: "A cross-household greeting from the friend who could not attend in person." },
    { title: "From the whole household", copy: "A familiar pet delivers the final line in a birthday montage or group message." },
  ],
  faqs: [
    { question: "Can I put the person's name in the birthday video?", answer: "Yes. Write your own line with the recipient's name, as long as the complete line is no more than 120 characters." },
    { question: "How many pets can appear?", answer: "Add one to six cats or dogs. Rarely preserves each pet as a separate member of one shared birthday scene." },
    { question: "Do all the pets talk together?", answer: "No. One pet delivers the greeting so the speech stays natural. The group joins only for a short, loosely overlapping celebratory reaction." },
    { question: "Can I send the finished video as a gift?", answer: "Yes. Download the MP4 and send it directly, post it, or include it in a larger birthday message." },
    { question: "How many birthday videos are included?", answer: "The $10 one-time pack includes three video credits, so you can try multiple lines or make videos for more than one pet." },
  ],
};

export const personalizedPetVideo: SeoIntent = {
  path: "/personalized-pet-video",
  title: "Personalized Pet Video From a Photo",
  description:
    "Create a personalized pet video from one cat or dog photo and your own short line. Download an eight-second vertical MP4 with sound.",
  eyebrow: "PERSONALIZED PET VIDEO",
  headline: "Personalized Pet Video From a Photo",
  accent: "",
  intro:
    "Use the photograph, expression, and private voice everyone around your pet already knows. Rarely turns them into a short video that feels made for one camera roll, one household, and one group chat.",
  image: "/pets/quiet-dog.jpg",
  imageAlt: "Beagle portrait used to create a personalized pet video",
  socialImage: "/social/og-talking-pet.jpg",
  socialImageAlt: "Create a personalized talking-pet video with Rarely",
  quote: "I do not follow you everywhere. I supervise locally.",
  proofTitle: "What makes the pet video personalized?",
  proofCopy:
    "The video uses your pet's real photo and a line you approve. You can download the finished vertical MP4 and decide where to share it.",
  steps: [
    { title: "Use their real photo", copy: "Start with the cat or dog you know, not a stock character or a generic avatar." },
    { title: "Make the line specific", copy: "Use their nickname, favorite demand, sworn enemy, or particular household jurisdiction." },
    { title: "Keep the finished moment", copy: "Download the private 9:16 video and decide if, when, and where it gets shared." },
  ],
  notesTitle: "Where the personalization actually comes from",
  notesIntro:
    "A template changes a name. A useful personalized pet video combines the real animal, a recognizable moment, and words chosen by someone who knows them.",
  notes: [
    { title: "Start with identity", copy: "Use the original pet photo rather than a stock animal or generated character. Clear markings, eyes, accessories, and surroundings give the finished video details worth preserving." },
    { title: "Add one private detail", copy: "A nickname, daily ritual, favorite object, or familiar demand can make a short line unmistakably theirs without turning it into a long explanation." },
    { title: "Control where it goes", copy: "The source photo and completed video remain private to the account until you download or share them. Delete saved source material from the studio when you no longer want it kept." },
  ],
  ideasTitle: "Made for the moments outside a template",
  ideasIntro: "A personalized pet video works best when it could not belong to anybody else's animal.",
  ideas: [
    { title: "An adoption anniversary", copy: "Give an old first-day photo the line they might deliver after running the house ever since." },
    { title: "A familiar ritual", copy: "Breakfast supervision, door duty, the 4 p.m. stare, or the nightly pillow negotiation." },
    { title: "A personal keepsake", copy: "Make a small performance from the photo you already return to again and again." },
  ],
  faqs: [
    { question: "What makes the pet video personalized?", answer: "It begins with your own pet photo and ends with a line you approve or write yourself. The visible expression and scene remain the creative starting point." },
    { question: "Are my pet photo and video public?", answer: "No. Uploads and completed videos stay private unless you choose to download or share them. You can delete saved source photos from your account." },
    { question: "Can I make more than one version?", answer: "Yes. Each completed video uses one credit, and a $10 pack includes three credits." },
    { question: "What file do I receive?", answer: "You receive an eight-second, 9:16 MP4 with sound for downloading or sharing." },
  ],
};

export const seoIntents = [
  talkingPetVideo,
  makeDogTalk,
  makeCatTalk,
  petBirthdayVideo,
  personalizedPetVideo,
];
