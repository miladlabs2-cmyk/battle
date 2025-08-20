import SecondsProgress from '../components/SecondsProgress'

export default function Betting_tick({ data }) {
    const total = Number(data?.seconds ?? 0)
    const left = Number(data?.seconds_left ?? 0)

    return (
        <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">betting_tick</h2>
            <SecondsProgress seconds={total} secondsLeft={left} barColor="bg-green-600" trackColor="bg-gray-300" />
        </div>
    )
}


