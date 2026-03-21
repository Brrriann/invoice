import { useEffect } from 'react';

interface LandingPageProps {
  onStartClick: () => void;
}

export default function LandingPage({ onStartClick }: LandingPageProps) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: '#F8FAFC', color: '#334155', fontFamily: "'Plus Jakarta Sans', 'Open Sans', sans-serif", minHeight: '100vh' }}>
      {/* Navbar */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(100, 116, 139, 0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '44px', height: '44px', background: '#F97316', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: '700' }}>📐</div>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#334155' }}>공정관리시스템</span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <button onClick={() => scrollTo('features')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'color 200ms' }}>기능</button>
            <button onClick={() => scrollTo('faq')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'color 200ms' }}>FAQ</button>
            <button onClick={onStartClick} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 200ms' }}>시작하기</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ paddingTop: '140px', paddingBottom: '80px', background: '#F8FAFC' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div className="fade-up" style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'inline-block', background: '#FEF3C7', color: '#F97316', fontSize: '12px', fontWeight: '700', padding: '0.5rem 1rem', borderRadius: '20px', marginBottom: '1.5rem', letterSpacing: '0.5px' }}>✨ 인테리어 현장의 완벽한 관리 솔루션</div>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '800', margin: '0 0 1.5rem', lineHeight: '1.2', color: '#334155' }}>
              현장 공정부터<br />
              <span style={{ color: '#F97316' }}>세금계산서, AI 마케팅까지</span><br />
              모두 하나로 관리
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#64748B', margin: '0 auto 2.5rem', lineHeight: '1.8', maxWidth: '700px' }}>
              공정 대시보드, 견적·세금계산서, 실측 템플릿, 엑셀 자동 생성, AI 마케팅까지.<br />
              바쁜 사장님들의 업무 효율을 90% 높이는 통합 솔루션입니다.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onStartClick} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '1rem 2rem', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 200ms' }}>무료로 시작하기</button>
              <button onClick={() => scrollTo('features')} style={{ background: '#fff', color: '#334155', border: '2px solid #E5E7EB', padding: '1rem 2rem', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 200ms' }}>둘러보기</button>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginTop: '4rem', maxWidth: '900px', margin: '4rem auto 0' }}>
            {[
              { num: '120+', label: '사용 중인 인테리어 업체' },
              { num: '90%', label: '업무 시간 단축' },
              { num: '99.9%', label: '데이터 보안' }
            ].map((stat, i) => (
              <div key={i} className="fade-up" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#F97316', marginBottom: '0.5rem' }}>{stat.num}</div>
                <div style={{ fontSize: '14px', color: '#64748B' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features (2x2 Grid) */}
      <section id="features" style={{ paddingTop: '80px', paddingBottom: '80px', background: '#fff' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>4가지 핵심 기능</h2>
            <p className="fade-up" style={{ fontSize: '1.1rem', color: '#64748B', margin: 0 }}>인테리어 현장의 모든 업무를 효율적으로 관리하세요</p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            {[
              { num: '01', title: '공정 대시보드', desc: '여러 현장을 카드로 관리하고, 공정 진행도, 외주비, 수금 현황을 한눈에 파악합니다.', features: ['공정 5단계 상태 관리', '외주 및 수금 추적', '캘린더 전체 일정 보기'] },
              { num: '02', title: '견적·세금계산서', desc: '자동 계산으로 견적서, 세금계산서, 발주서까지 한 번에 생성합니다. 엑셀 다운로드도 가능합니다.', features: ['부가세 자동 계산', '세금계산서 발행', '엑셀 자동 생성'] },
              { num: '03', title: '실측 템플릿', desc: '현장에서 규격, 마감재, 사진을 바로 입력하고, 체계적인 리포트로 저장합니다.', features: ['가로·세로·높이 입력', '마감재 상태 기록', '현장 사진 자동 임베드'] },
              { num: '04', title: 'AI 마케팅 글', desc: '시공 정보를 입력하면 AI가 블로그 맞춤형 마케팅 글을 즉시 생성합니다.', features: ['Gemini AI 기반 생성', '톤앤매너 선택 가능', '마케팅 시간 90% 절약'] }
            ].map((item, i) => (
              <div key={i} className="fade-up" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '2rem' }}>
                <div style={{ width: '50px', height: '50px', background: '#F97316', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '1.5rem' }}>{item.num}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 0.75rem', color: '#334155' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 1.5rem', lineHeight: '1.6' }}>{item.desc}</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {item.features.map((feature, j) => (
                    <li key={j} style={{ fontSize: '13px', color: '#475569', margin: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#F97316', fontWeight: '700' }}>✓</span> {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px', background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F5 100%)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>더 많은 기능들</h2>
            <p className="fade-up" style={{ fontSize: '1.1rem', color: '#64748B', margin: 0 }}>업무 효율을 극대화하는 추가 기능</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            {[
              { icon: '📊', title: '데이터 분석', desc: '월별, 분기별 매출 현황과 수금률 분석', comingSoon: true },
              { icon: '👥', title: '팀 협업', desc: '작업자 초대 및 권한 관리로 팀 협업', comingSoon: true },
              { icon: '🔔', title: '스마트 알림', desc: '공정 지연, 수금 기한 등 실시간 알림', comingSoon: true },
              { icon: '📱', title: '모바일 최적화', desc: '현장에서 스마트폰으로 모든 기능 사용' },
              { icon: '☁️', title: '고급보안', desc: '모든 데이터는 안전하게 고급보안으로 암호화' },
              { icon: '🔐', title: '보안 인증', desc: '은행급 보안으로 데이터 보호' }
            ].map((item, i) => (
              <div key={i} className="fade-up" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '2rem', textAlign: 'center', position: 'relative', opacity: item.comingSoon ? 0.85 : 1 }}>
                {item.comingSoon && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#F97316', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '0.4rem 0.8rem', borderRadius: '4px' }}>준비중</div>
                )}
                <div style={{ fontSize: '40px', marginBottom: '1rem' }}>{item.icon}</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 0.5rem', color: '#334155' }}>{item.title}</h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Overview / Screenshots */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px', background: '#fff' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>시스템 미리보기</h2>
            <p className="fade-up" style={{ fontSize: '1.1rem', color: '#64748B', margin: 0 }}>실제 사용 화면을 확인하세요</p>
          </div>

          <div className="fade-up" style={{ background: '#1E1B4B', borderRadius: '12px', padding: '2rem', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 1rem', color: '#F97316' }}>공정 대시보드</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', maxWidth: '500px', margin: '0 0 2rem' }}>
              현장별 공정 진행도, 외주비, 수금 현황을 한눈에 관리.<br />
              캘린더 보기로 전체 일정을 효율적으로 추적합니다.
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>✓ 실시간 업데이트 ✓ 드래그 앤 드롭 ✓ 상세 필터링</p>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px', background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F5 100%)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>고객들의 성공 사례</h2>
            <p className="fade-up" style={{ fontSize: '1.1rem', color: '#64748B', margin: 0 }}>실제 사용자들의 경험을 들어보세요</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {[
              { name: '김철수', company: 'A인테리어', role: '대표', feedback: '업무 시간이 50% 줄었어요. 특히 세금계산서 자동 생성이 정말 좋습니다.', rating: '⭐⭐⭐⭐⭐' },
              { name: '이영희', company: 'B건설', role: '설계팀장', feedback: '현장 관리가 이렇게 쉬울 수 있다니. 팀 협업이 훨씬 수월해졌어요.', rating: '⭐⭐⭐⭐⭐' },
              { name: '박민준', company: 'C리모델링', role: '사무장', feedback: 'AI 마케팅 글 기능이 정말 신기합니다. 마케팅에 투자하는 시간을 거의 줄였어요.', rating: '⭐⭐⭐⭐⭐' }
            ].map((story, i) => (
              <div key={i} className="fade-up" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '2rem' }}>
                <div style={{ marginBottom: '1rem', fontSize: '14px', color: '#F97316' }}>{story.rating}</div>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 1.5rem', lineHeight: '1.6', fontStyle: 'italic' }}>"{story.feedback}"</p>
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{story.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{story.company} · {story.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section style={{ paddingTop: '80px', paddingBottom: '80px', background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F5 100%)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>간단한 사용 흐름</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            {[
              { step: '1', title: '회원가입', desc: '이메일로 1분이면 가입 완료' },
              { step: '2', title: '현장 등록', desc: '현장 정보와 고객 정보 입력' },
              { step: '3', title: '업무 시작', desc: '공정, 견적, 실측, AI 글 작성' },
              { step: '4', title: '수익 증대', desc: '효율 상승으로 더 많은 프로젝트 관리' }
            ].map((item, i) => (
              <div key={i} className="fade-up" style={{ textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', background: '#F97316', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', margin: '0 auto 1.5rem', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)' }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 0.5rem', color: '#334155' }}>{item.title}</h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ paddingTop: '80px', paddingBottom: '80px', background: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 className="fade-up" style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem', color: '#334155' }}>자주 묻는 질문</h2>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { q: '여러 현장을 동시에 관리할 수 있나요?', a: '네. 요금제에 따라 현장을 무제한으로 추가할 수 있습니다. DELUXE 이상 요금제에서는 현장 개수 제한이 없습니다.' },
              { q: '세금계산서는 어떻게 발행하나요?', a: '고객사 정보와 금액을 정리한 엑셀파일을 다운으실 수 있습니다. 홈택스나 내부 관리 프로그램에 붙여넣기가 가능합니다.' },
              { q: '엑셀로 내보낼 수 있나요?', a: '세금계산서 작성 후 고객사 정보와 금액이 정리된 엑셀파일로 다운로드할 수 있습니다. 홈택스나 내부 관리 프로그램에 붙여넣기가 가능합니다.' },
              { q: 'AI 마케팅 글의 품질은?', a: '구글 Gemini AI를 사용하여 현장 정보를 바탕으로 전문적인 마케팅 글을 생성합니다. 톤앤매너도 선택할 수 있습니다.' },
              { q: '모바일에서도 사용할 수 있나요?', a: '네. 앱 설치 없이 스마트폰 브라우저에서 모든 기능을 사용할 수 있습니다. 현장에서 실측을 입력하고, 사무실에서 확인하세요.' },
              { q: '데이터는 안전한가요?', a: '모든 데이터는 고급보안으로 암호화되어 저장됩니다. 은행급 보안으로 보호되며, 정기적인 백업이 진행됩니다.' }
            ].map((item, i) => (
              <details key={i} className="fade-up" style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '10px', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
                <summary style={{ fontWeight: '700', color: '#334155', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{item.q}</span>
                  <span style={{ fontSize: '18px', transition: 'transform 300ms' }}>▼</span>
                </summary>
                <p style={{ marginTop: '1rem', color: '#64748B', fontSize: '14px', lineHeight: '1.6', margin: '1rem 0 0' }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ paddingTop: '100px', paddingBottom: '100px', background: '#334155' }}>
        <div className="fade-up" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1.5rem', color: '#fff' }}>지금 시작하세요</h2>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.8)', margin: '0 0 2rem', lineHeight: '1.6' }}>
            무료 가입 후 모든 기능을 7일간 체험하세요.<br />
            신용카드 정보는 필요 없습니다.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onStartClick} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '1rem 2rem', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)', transition: 'all 200ms' }}>무료로 시작하기</button>
            <a href="mailto:Brain_Lee@inteinvo.cc" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)', padding: '1rem 2rem', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', transition: 'all 200ms' }}>문의하기</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(100, 116, 139, 0.1)', padding: '3rem 2rem', background: '#F8FAFC' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '36px', height: '36px', background: '#F97316', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: '700' }}>📐</div>
              <span style={{ fontWeight: '700', color: '#334155' }}>공정관리시스템</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>인테리어 현장 관리의 새로운 기준</p>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>제품</div>
            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href="#features" style={{ color: '#64748B', textDecoration: 'none' }}>기능</a>
              <a href="#faq" style={{ color: '#64748B', textDecoration: 'none' }}>FAQ</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>지원</div>
            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href="mailto:Brain_Lee@inteinvo.cc" style={{ color: '#64748B', textDecoration: 'none' }}>문의</a>
              <a href="#faq" style={{ color: '#64748B', textDecoration: 'none' }}>FAQ</a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>© 2026 공정관리시스템. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '12px' }}>
            <a href="mailto:Brain_Lee@inteinvo.cc" style={{ color: '#F97316', textDecoration: 'none', fontWeight: '600' }}>문의하기</a>
            <span style={{ color: '#94A3B8' }}>Brain_Lee@inteinvo.cc</span>
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        * {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .fade-up {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .features-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }

        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr !important;
          }
        }

        button:hover { opacity: 0.9; transform: translateY(-1px); }
        a:hover { opacity: 0.8; }
        details summary::-webkit-details-marker { display: none; }
        details[open] summary span:last-child { transform: rotate(180deg); }
      `}</style>
    </div>
  );
}
