import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Achievements.scss";
import { useState, useEffect } from "react";
import achievementService, { getUploadUrl } from "../../services/achievementService";

function Achievements() {
  useEffect(() => { document.title = "Наши успехи"; }, []);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    achievementService.getPublic()
      .then(setStories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Description is stored as a JSON array of strings, or plain text
  const parseDescription = (raw) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return raw.split("\n").filter(Boolean);
    }
  };

  return (
    <div className="page page--achievements">
      <Header />

      <main className="achievements">
        <section className="achievements__hero">
          <div className="container">
            <span className="section-badge">Наши успехи</span>
            <h1>Истории маленьких побед</h1>
            <p>
              Каждая история — это путь ребёнка, семьи и специалистов Центра.
              Мы радуемся даже небольшим шагам, потому что именно из них
              складываются большие возможности.
            </p>
          </div>
        </section>

        <section className="achievements__stories">
          <div className="container achievements__grid">
            {loading ? (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>Загрузка...</p>
            ) : stories.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>
                Истории успеха скоро появятся здесь.
              </p>
            ) : (
              stories.map((story) => (
                <article className="achievement-card" key={story.id}>
                  <div className="achievement-card__media">
                    {story.image_url && (
                      <img src={getUploadUrl(story.image_url)} alt={story.child_name} />
                    )}
                    {story.second_image_url && (
                      <img src={getUploadUrl(story.second_image_url)} alt="" />
                    )}
                  </div>

                  <div className="achievement-card__content">
                    <span>История успеха</span>
                    <h2>{story.child_name}</h2>
                    {parseDescription(story.description).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {story.conclusion && (
                      <strong>{story.conclusion}</strong>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Achievements;
