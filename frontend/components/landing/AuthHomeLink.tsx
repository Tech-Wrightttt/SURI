import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./auth-home-link.module.css";

export default function AuthHomeLink() {
  return <Link href="/" className={`topics-library-back ${styles.link}`}><ArrowLeft size={16} aria-hidden="true" /> Back to home</Link>;
}
