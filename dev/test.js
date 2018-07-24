const Blockchain= require('./blockchain');

const bitcoin= new Blockchain();


const previousBlockHash= '01NJJEFHIWHI1E182U812OEJEJBN3EBJ3';
const currentBlockData=[
    {
        amount: 10,
        sender: 'fdjwhefuwhfuh',
        recipient: 'ebfjewbfjwebfj'
    },
    {
        amount: 20,
        sender: 'fdjwhefuwhfuh',
        recipient: 'ebfjewbfjwebfj'
    },
    {
        amount: 30,
        sender: 'fdjwhefuwhfuh',
        recipient: 'ebfjewbfjwebf'
    }
]
// console.log(bitcoin.proofOfWork(previousBlockHash,currentBlockData))
// const nonce=100;

console.log(bitcoin.hashBlock(previousBlockHash, currentBlockData, 5358))

//bitcoin.createNewBlock(2389, 'asbbiuhfausifh', '124jdiqwd');
//bitcoin.createNewBlock(29, 'biuhfausifh', 'hjhjqjdiqwd');
//bitcoin.createNewBlock(1329, '0921biuhfausifh', 'wkqjdiqwd');
// bitcoin.createNewTransaction(100, 'ALEXshdfu','JENNfhwuehf');
// bitcoin.createNewBlock(29, 'biuhfausifh', 'hjhjqjdiqwd');
// bitcoin.createNewTransaction(2000, 'ALEXshdfu','JENNfhwuehf');
// bitcoin.createNewTransaction(50, 'ALEXshdfu','JENNfhwuehf');
// bitcoin.createNewTransaction(330, 'ALEXshdfu','JENNfhwuehf');
//bitcoin.createNewBlock(1329, '0921biuhfausifh', 'wkqjdiqwd');

//console.log(bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce));