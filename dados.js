
const foto = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;

const API = '/api';
const CARDAPIO_DEMO = [
  { id: 1, nome: 'Margherita da casa', categoria: 'Pizzas tradicionais', descricao: 'Molho de tomate artesanal, mozzarella, manjericão fresco e azeite extravirgem.', preco: 49.9, imagem: foto('photo-1574071318508-1cdbab80d002'), selo: 'A favorita da casa', vegetariana: true },
  { id: 2, nome: 'Calabresa & cebola', categoria: 'Pizzas tradicionais', descricao: 'Calabresa artesanal, cebola roxa, mozzarella e um toque de orégano.', preco: 54.9, imagem: foto('photo-1565299624946-b28f40a0ae38'), selo: '', vegetariana: false },
  { id: 3, nome: 'Quatro queijos', categoria: 'Pizzas especiais', descricao: 'Mozzarella, gorgonzola, parmesão e catupiry. Cremosa em cada fatia.', preco: 64.9, imagem: foto('photo-1513104890138-7c749659a591'), selo: 'Mais pedida', vegetariana: true },
  { id: 4, nome: 'Pepperoni especial', categoria: 'Pizzas especiais', descricao: 'Pepperoni levemente picante, mozzarella e nosso molho de tomate da casa.', preco: 62.9, imagem: foto('photo-1613564834361-9436948817d1'), selo: '', vegetariana: false },
  { id: 5, nome: 'Rústica do forno', categoria: 'Pizzas especiais', descricao: 'Cogumelos frescos, azeitonas, mozzarella e ervas selecionadas.', preco: 69.9, imagem: foto('photo-1604382354936-07c5d9983bd3'), selo: 'Novidade', vegetariana: true },
  { id: 6, nome: 'Portuguesa', categoria: 'Pizzas tradicionais', descricao: 'Presunto, ovos, cebola, azeitonas e mozzarella. Um clássico de verdade.', preco: 57.9, imagem: foto('photo-1593504049359-74330189a345'), selo: '', vegetariana: false },
  { id: 7, nome: 'Água mineral', categoria: 'Bebidas', descricao: 'Água mineral sem gás, 500 ml. Para acompanhar sua favorita.', preco: 6, imagem: '', selo: '', vegetariana: false },
];

let PRODUTOS = CARDAPIO_DEMO;
let CATEGORIAS = ['Todos', 'Pizzas tradicionais', 'Pizzas especiais', 'Bebidas'];

const PAGINAS = ['Início', 'Cardápio', 'Carrinho', 'Pedidos', 'Perfil', 'Login', 'Cadastro'];

const FOTOS = {
  heroInicio: foto('photo-1579751626657-72bc17010498'),
  heroCardapio: foto('photo-1513104890138-7c749659a591'),
  historia: foto('photo-1622880833523-7cf1c0bd4296'),
};

const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
