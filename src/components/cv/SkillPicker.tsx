"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Search } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";

type SkillGroup = { labelKey: MessageKey; items: string[] };

const SKILL_GROUPS: SkillGroup[] = [
  {
    labelKey: "builder.skillGroupLanguages",
    items: [
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "C",
      "Go",
      "Rust",
      "PHP",
      "Ruby",
      "Kotlin",
      "Swift",
      "Dart",
      "Scala",
      "Elixir",
      "SQL",
      "Bash",
      "PowerShell",
      "R",
      "MATLAB",
      "Perl",
      "Lua",
      "Objective-C",
    ],
  },
  {
    labelKey: "builder.skillGroupFrontend",
    items: [
      "React",
      "Next.js",
      "Vue.js",
      "Nuxt.js",
      "Angular",
      "Svelte",
      "React Native",
      "Flutter",
      "HTML",
      "CSS",
      "Sass",
      "Tailwind CSS",
      "Redux",
      "Vite",
    ],
  },
  {
    labelKey: "builder.skillGroupBackend",
    items: [
      "Node.js",
      "NestJS",
      "Express.js",
      "Spring Boot",
      ".NET",
      "Django",
      "Flask",
      "FastAPI",
      "Laravel",
      "Ruby on Rails",
      "GraphQL",
      "REST API",
      "gRPC",
      "PostgreSQL",
      "MySQL",
      "SQL Server",
      "MongoDB",
      "Redis",
      "Elasticsearch",
      "Kafka",
      "RabbitMQ",
      "SQLite",
      "Supabase",
      "Firebase",
    ],
  },
  {
    labelKey: "builder.skillGroupDevops",
    items: [
      "Docker",
      "Kubernetes",
      "AWS",
      "Azure",
      "Google Cloud",
      "Terraform",
      "Ansible",
      "Jenkins",
      "GitHub Actions",
      "GitLab CI",
      "Git",
      "Linux",
      "Nginx",
      "Prometheus",
      "Grafana",
      "Datadog",
      "Sentry",
      "CI/CD",
      "Microservices",
      "Agile/Scrum",
    ],
  },
  {
    labelKey: "builder.skillGroupData",
    items: [
      "Machine Learning",
      "TensorFlow",
      "PyTorch",
      "Pandas",
      "NumPy",
      "Apache Spark",
      "Airflow",
      "Figma",
    ],
  },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseSkills = (value: string) =>
  value
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function SkillPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseSkills(value), [value]);
  const selectedKeys = useMemo(
    () => new Set(selected.map(normalize)),
    [selected],
  );

  const groups = useMemo(() => {
    const needle = normalize(query);
    return SKILL_GROUPS.map((group) => ({
      ...group,
      items: needle
        ? group.items.filter((item) => normalize(item).includes(needle))
        : group.items,
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const indexOf = useMemo(
    () => new Map(flat.map((item, index) => [item, index])),
    [flat],
  );

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const toggle = (skill: string) => {
    const key = normalize(skill);
    const exists = selectedKeys.has(key);
    const next = exists
      ? selected.filter((item) => normalize(item) !== key)
      : [...selected, skill];
    onChange(next.join(", "));
    setHighlight(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (flat.length ? (prev + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) =>
        flat.length ? (prev - 1 + flat.length) % flat.length : 0,
      );
    } else if (event.key === "Enter") {
      if (open && flat[highlight]) {
        event.preventDefault();
        toggle(flat[highlight]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="skill-picker" ref={wrapRef}>
      <div className="skill-picker-control">
        <Search size={14} aria-hidden="true" />
        <input
          value={query}
          placeholder={t("builder.skillPickerPlaceholder")}
          role="combobox"
          aria-expanded={open}
          aria-controls="skill-picker-list"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) {
              setOpen(false);
            }
          }}
        />
      </div>
      {open ? (
        <div
          className="skill-picker-menu"
          id="skill-picker-list"
          role="listbox"
          aria-multiselectable="true"
          onMouseDown={(event) => event.preventDefault()}
        >
          {groups.length === 0 ? (
            <p className="skill-picker-empty">{t("builder.skillPickerEmpty")}</p>
          ) : (
            groups.map((group) => (
              <div key={group.labelKey} className="skill-picker-group">
                <span className="skill-picker-group-label">
                  {t(group.labelKey)}
                </span>
                {group.items.map((item) => {
                  const active = selectedKeys.has(normalize(item));
                  const focused = indexOf.get(item) === highlight;
                  return (
                    <button
                      key={item}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`skill-picker-option${
                        active ? " is-selected" : ""
                      }${focused ? " is-active" : ""}`}
                      onMouseEnter={() => setHighlight(indexOf.get(item) ?? 0)}
                      onClick={() => toggle(item)}
                    >
                      <span>{item}</span>
                      {active ? <Check size={13} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
