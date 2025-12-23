import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppShell({ title, children }) {
  return (
    <div style={styles.root}>
      <Header title={title} />
      <div style={styles.body}>
        <Sidebar />
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#f3f4f6" },
  body: { display: "flex", minHeight: "calc(100vh - 56px)" },
  main: { flex: 1, padding: 16 },
};
