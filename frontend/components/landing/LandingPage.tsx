"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Check, ChevronDown, Compass, GraduationCap,
  LogIn, Menu, RotateCcw, ShieldCheck, Sparkles, Swords, Target,
  Trophy, UserPlus, X,
} from "lucide-react";
import styles from "./landing.module.css";

const destinations = [
  {
    image: "/landing/library-card.webp", icon: BookOpen, number: "01", title: "Topic Library",
    description: "Explore algebra topics and the foundations behind each one.",
    detail: "Equations · Exponents · Polynomials", className: "library",
  },
  {
    image: "/landing/arena-card.webp", icon: Swords, number: "02", title: "Practice Arena",
    description: "Work through problems with feedback, hints, and math villains.",
    detail: "Guided practice · Topic quizzes", className: "arena",
  },
  {
    image: "/landing/results-card.webp", icon: Trophy, number: "03", title: "Progress Trail",
    description: "Review topic mastery, past attempts, and mistakes to revisit.",
    detail: "Mastery · Learning history", className: "progress",
  },
];

const steps = [
  { icon: BookOpen, title: "Choose a topic", description: "Start in the Topic Library." },
  { icon: Target, title: "Check your skills", description: "A diagnostic finds gaps in prerequisite skills." },
  { icon: GraduationCap, title: "Study a lesson", description: "Learn the foundations you need for that topic." },
  { icon: Swords, title: "Practice & review", description: "Solve problems, take a quiz, and review the results." },
];

const questions = [
  { question: "Who is SURI for?", answer: "SURI is designed for Philippine junior high school students. Registration supports Grades 7 to 10. Lessons focus on algebra and the earlier skills needed to understand it." },
  { question: "How are lessons chosen?", answer: "A diagnostic identifies gaps in prerequisite skills. SURI uses the results to guide you toward relevant lessons before you continue with practice and a topic quiz." },
  { question: "What can I study?", answer: "Topics include equations, exponents, polynomials, and factoring, with supporting skills such as fractions and integers. Lesson content is grounded in DepEd curriculum materials." },
  { question: "Can I try it without an account?", answer: "You can answer the sample practice question on this page. Create an account to access lessons and save your learning progress." },
];

function DeferredArtwork({ src }: { src: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <span ref={container} className={styles.deferredArtwork}>{visible && <Image src={src} alt="" fill sizes="(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 70vw" loading="lazy" />}</span>;
}

function PracticePreview() {
  const [answer, setAnswer] = useState<number | null>(null);
  const solved = answer === 6;

  return (
    <div className={styles.practicePanel}>
      <div className={styles.panelBar}><span><Swords size={19} /> Sample practice</span><span className={styles.demoBadge}>DEMO</span></div>
      <div className={styles.practiceBody}>
        <div className={styles.enemy}>
          <Image src="/equation-golem-villain.webp" width={150} height={150} alt="Equation Golem" />
          <div><span className={styles.label}>LINEAR EQUATIONS</span><h3>Equation Golem</h3><p>Solve the equation to complete this example.</p></div>
        </div>
        <div className={styles.equation}><span>Find the value of x</span><strong>2x + 6 = 18</strong></div>
        <fieldset className={styles.answers} disabled={solved}>
          <legend className={styles.srOnly}>Choose the value of x</legend>
          {[4, 6, 12].map(value => <button type="button" key={value} aria-pressed={answer === value} className={answer === value ? (solved ? styles.correct : styles.incorrect) : ""} onClick={() => setAnswer(value)}>x = {value}{answer === value && (solved ? <Check size={18} /> : <X size={18} />)}</button>)}
        </fieldset>
        <div className={`${styles.feedback} ${solved ? styles.success : ""}`} aria-live="polite" aria-atomic="true">
          {answer === null ? <><Target size={20} /><span>Select an answer. You can retry if you make a mistake.</span></> : solved ? <><ShieldCheck size={22} /><span><strong>Correct! x = 6.</strong> Subtract 6 from both sides, then divide by 2.</span></> : <><BookOpen size={22} /><span><strong>Not quite. Try again.</strong> Subtract 6 from both sides first: 2x = 12.</span></>}
        </div>
        <div className={styles.practiceFoot}><span>Preview only. Results are not saved.</span>{answer !== null && <button type="button" onClick={() => setAnswer(null)} aria-label="Reset sample practice"><RotateCcw size={15} /> Reset</button>}</div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.landing}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="SURI home"><Image src="/SURI1.webp" alt="SURI" width={300} height={100} priority /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation"><a href="#features">Explore SURI</a><a href="#how-it-works">How it works</a><a href="#sample-practice">Try practice</a></nav>
          <div className={styles.headerActions}><Link href="/login" className={styles.loginLink}><LogIn size={17} /> Log in</Link><button type="button" className={styles.menuToggle} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
        </div>
        {menuOpen && <nav id="landing-mobile-nav" className={styles.mobileNav} aria-label="Mobile navigation" onClick={() => setMenuOpen(false)}><a href="#features">Explore SURI</a><a href="#how-it-works">How it works</a><a href="#sample-practice">Try practice</a><a href="#questions">About SURI</a></nav>}
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <picture className={styles.heroArt}><source media="(max-width: 600px)" srcSet="/landing/academy-mobile.webp" /><img src="/landing/academy-desktop.webp" alt="Floating islands and a castle in SURI’s math world" width={1600} height={901} loading="eager" fetchPriority="high" decoding="async" /></picture>
          <div className={styles.heroInner}>
            <div className={styles.heroBoard}>
              <div className={styles.heroBoardInset}>
                <div className={styles.heroBoardTop}><Compass size={17} /> SURI MATH QUEST <span>GRADES 7–10</span></div>
                <h1 id="hero-title">Algebra, <em>step by step.</em></h1>
                <p>SURI finds gaps in your math skills, guides you through relevant lessons, and gives you a place to practice what you learn.</p>
                <div className={styles.heroTags}><span><Target size={16} /> Adaptive lessons</span><span><BookOpen size={16} /> DepEd-based content</span></div>
                <div className={styles.heroActions}><Link href="/register" className={styles.primaryButton}><UserPlus size={19} /> Create an account <ArrowRight size={19} /></Link><a href="#features" className={styles.heroExplore}>Explore SURI <ChevronDown size={17} /></a></div>
              </div>
            </div>
            <div className={styles.heroDisplay} aria-hidden="true">
              <div className={styles.displayImage}><Image src="/landing/bookstand.webp" alt="" fill sizes="(max-width: 900px) 0px, 420px" /></div>
              <div className={styles.mascot}><Image src="/suri-snake-happy.webp" alt="" width={160} height={160} /></div>
              <div className={styles.displayPlaque}><Sparkles size={17} /> LESSONS · PRACTICE · PROGRESS</div>
            </div>
          </div>
          <div className={styles.heroBottom}><span><GraduationCap size={18} /> For junior high learners</span><span><Target size={18} /> Starts with a skill check</span><span><Trophy size={18} /> Tracks your progress</span></div>
        </section>

        <section id="features" className={styles.featuresSection} aria-labelledby="features-title">
          <div className={styles.sectionIntro}><span className={styles.eyebrow}>THE KINGDOM MAP</span><h2 id="features-title">Three places to learn</h2><p>Each part of the world supports a different part of your math journey.</p></div>
          <div className={styles.destinationGrid}>{destinations.map(({ image, icon: Icon, number, title, description, detail, className }) => <article key={number} className={`${styles.destination} ${styles[className]}`}><div className={styles.destinationImage}><DeferredArtwork src={image} /><span className={styles.destinationNumber}>{number}</span></div><div className={styles.destinationCopy}><span className={styles.destinationIcon}><Icon size={26} /></span><div><h3>{title}</h3><p>{description}</p><span className={styles.destinationDetail}>{detail}</span></div></div></article>)}</div>
        </section>

        <section id="how-it-works" className={styles.howSection} aria-labelledby="how-title"><div className={styles.howInner}><div className={styles.howHeading}><span className={styles.eyebrow}>YOUR LEARNING PATH</span><h2 id="how-title">How a topic works</h2><p>One sequence takes you from your starting point to a topic review.</p></div><ol className={styles.steps}>{steps.map(({ icon: Icon, title, description }, index) => <li key={title}><span className={styles.stepNumber}>{String(index + 1).padStart(2,"0")}</span><Icon size={26} /><h3>{title}</h3><p>{description}</p></li>)}</ol></div></section>

        <section id="sample-practice" className={styles.sampleSection} aria-labelledby="sample-title"><Image src="/landing/arena-background.webp" alt="" fill sizes="100vw" className={styles.sampleBackground} loading="lazy" /><div className={styles.sampleInner}><div className={styles.sampleInfo}><span className={styles.eyebrow}>TRY IT HERE</span><h2 id="sample-title">A quick practice question</h2><p>Answer this sample equation and see the feedback SURI gives. Your result stays on this page.</p><div className={styles.sampleMascot}><Image src="/suri-snake-happy.webp" alt="SURI’s snake companion" width={75} height={75} /><span>Try an answer. You can always try again.</span></div></div><PracticePreview /></div></section>

        <section id="questions" className={styles.aboutSection} aria-labelledby="faq-title"><div className={styles.aboutInner}><div className={styles.aboutHeading}><span className={styles.eyebrow}>BEFORE YOU START</span><h2 id="faq-title">About SURI</h2><p>Answers to the most common questions.</p></div><div className={styles.faqList}>{questions.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={20} /></summary><p>{answer}</p></details>)}</div></div></section>
      </main>
      <footer className={styles.footer}><span>SURI · Adaptive Mathematics Learning</span><nav aria-label="Footer navigation"><a href="#features">Explore</a><a href="#questions">About</a><Link href="/login">Log in</Link><Link href="/register">Sign up <ArrowRight size={14} /></Link></nav></footer>
    </div>
  );
}
