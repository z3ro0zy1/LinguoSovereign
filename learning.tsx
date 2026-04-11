import React, { createContext, useContext, useState, ReactNode } from 'react';

// --- 第一步：定义数据的类型（TypeScript 增强健壮性） ---
interface ThemeContextType {
  theme: 'light' | 'dark';      // 当前主题状态
  toggleTheme: () => void;      // 修改主题的方法
}

// --- 第二步：创建 Context 对象 ---
// 默认值通常设为 undefined，并在后续通过 Provider 注入真实值
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// --- 第三步：封装 Provider 组件 (电梯源头) ---
// 这样做的好处是把逻辑封装在一起，让 App 变得整洁
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    // 将状态和方法通过 value 属性“广播”出去
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// --- 第四步：自定义 Hook (方便子组件调用) ---
// 这是一个最佳实践，省去了每次都要 import ThemeContext 的麻烦
const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内部使用');
  }
  return context;
};

// --- 第五步：深层嵌套的子组件 (孙子组件) ---
const ThemeButton = () => {
  // 直接从 Context 取货，不需要父级传 props
  const { theme, toggleTheme } = useTheme();

  const btnStyle = {
    backgroundColor: theme === 'light' ? '#fff' : '#333',
    color: theme === 'light' ? '#000' : '#fff',
    padding: '10px 20px',
    cursor: 'pointer',
    border: '1px solid #ccc'
  };

  return (
    <button style={btnStyle} onClick={toggleTheme}>
      当前主题：{theme === 'light' ? '🌞 浅色' : '🌙 深色'} (点击切换)
    </button>
  );
};

// --- 第六步：中间组件 (不关心主题，仅负责布局) ---
const Layout = () => {
  console.log('中间层 Layout 渲染了'); // 注意：Layout 不会因为主题变化而重新渲染，除非它也用了 useContext
  return (
    <div style={{ padding: '20px', border: '1px solid gray' }}>
      <h3>我是一个中间层容器</h3>
      <ThemeButton />
    </div>
  );
};

// --- 第七步：根组件 ---
export default function App() {
  return (
    <ThemeProvider>
      <div style={{ padding: '20px' }}>
        <h1>React Context 跨级通信演示</h1>
        <p>这个例子展示了如何跨越中间层直接修改和读取顶层状态。</p>
        <Layout />
      </div>
    </ThemeProvider>
  );
}