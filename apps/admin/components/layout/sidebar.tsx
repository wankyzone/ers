import { navigation } from "@/lib/navigation";

export function Sidebar() {
  return (
    <aside aria-label="Dashboard sidebar">
      <nav aria-label="Dashboard navigation">
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
